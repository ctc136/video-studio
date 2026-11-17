import {Player, type PlayerRef} from '@remotion/player';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {StoryboardVideo} from '../remotion/Video';
import {themes} from '../remotion/themes';
import {TEMPLATE_LABELS, defaultScene, emptyStoryboard, newSceneId, sceneSummary} from '../shared/defaults';
import {
  ASPECTS,
  type Aspect,
  FPS,
  type Scene,
  type Storyboard,
  TEMPLATE_IDS,
  THEME_IDS,
  TRANSITION_TYPES,
  type TemplateId,
  type ThemeId,
  slugify,
  validateStoryboard,
} from '../shared/schema';
import {buildTimeline, needsVoiceover} from '../shared/timeline';
import {SceneForm} from './SceneForm';
import {ApiError, type GenerateAttempt, type RenderJob, api} from './api';

type Notice = {kind: 'info' | 'error' | 'ok'; text: string; details?: string[]};

const LAST_OPENED = 'video-studio:last';
const formatSeconds = (s: number) => `${s.toFixed(1)}s`;

export const App: React.FC = () => {
  // `draft` is what the form edits and may be briefly invalid while typing.
  // The preview always shows `valid`: the last version that passed validation.
  const [draft, setDraft] = useState<Storyboard>(emptyStoryboard);
  const [valid, setValid] = useState<Storyboard>(draft);
  const [name, setName] = useState('untitled');
  const [savedJson, setSavedJson] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>(draft.scenes[0]?.id);
  const [aspect, setAspect] = useState<Aspect>('16:9');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [names, setNames] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [voices, setVoices] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [modelError, setModelError] = useState<string>();

  const [concept, setConcept] = useState('');
  const [model, setModel] = useState('');
  const [ideaTheme, setIdeaTheme] = useState<ThemeId | 'auto'>('auto');
  const [ideaSeconds, setIdeaSeconds] = useState(30);
  const [attempts, setAttempts] = useState<GenerateAttempt[]>([]);

  const [jobs, setJobs] = useState<Partial<Record<Aspect, RenderJob>>>({});
  const [playingIndex, setPlayingIndex] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [jsonText, setJsonText] = useState<string | null>(null);

  const playerRef = useRef<PlayerRef>(null);
  const generationRef = useRef(0);

  const validation = useMemo(() => validateStoryboard(draft), [draft]);
  useEffect(() => {
    if (validation.ok) setValid(validation.storyboard);
  }, [validation]);

  const timeline = useMemo(() => buildTimeline(valid), [valid]);
  const dirty = JSON.stringify(draft) !== savedJson;
  // The timeline follows the last valid storyboard, so look scenes up by id.
  const timingFor = (id: string | undefined) => timeline.scenes[valid.scenes.findIndex((s) => s.id === id)];
  const selected = draft.scenes.find((s) => s.id === selectedId) ?? draft.scenes[0];
  const voiceoverStale = needsVoiceover(valid);

  const fail = useCallback((err: unknown) => {
    const e = err as ApiError;
    setNotice({kind: 'error', text: e.message ?? String(err), details: e.errors});
  }, []);

  const adopt = useCallback((storyboard: Storyboard, newName: string, saved: boolean) => {
    setDraft(storyboard);
    setValid(storyboard);
    setName(newName);
    setSavedJson(saved ? JSON.stringify(storyboard) : '');
    setSelectedId(storyboard.scenes[0]?.id);
    setJsonText(null);
    generationRef.current += 1;
    setJobs({});
    playerRef.current?.seekTo(0);
  }, []);

  const open = useCallback(
    async (target: string) => {
      try {
        const res = await api.loadStoryboard(target);
        adopt(res.storyboard, res.name, true);
        localStorage.setItem(LAST_OPENED, res.name);
        setNotice(null);
      } catch (err) {
        fail(err);
      }
    },
    [adopt, fail],
  );

  // Initial load: lists, then the last storyboard you had open (or the sample).
  useEffect(() => {
    api.listImages().then((r) => setImages(r.images), () => {});
    api.listVoices().then((r) => setVoices(r.voices), () => {});
    api.listModels().then(
      (r) => {
        setModels(r.models);
        setModelError(r.error);
        setModel(r.models.find((m) => m.startsWith(r.default)) ?? r.models[0] ?? r.default);
      },
      () => {},
    );
    api.listStoryboards().then((r) => {
      setNames(r.names);
      const last = localStorage.getItem(LAST_OPENED);
      const first = last && r.names.includes(last) ? last : r.names.includes('sample') ? 'sample' : r.names[0];
      if (first) void open(first);
    }, fail);
  }, [open, fail]);

  // Follow playback so the scene list shows what is on screen.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: {detail: {frame: number}}) => {
      let index = 0;
      timeline.scenes.forEach((s, i) => {
        if (e.detail.frame >= s.from + (i > 0 ? timeline.transitionFrames / 2 : 0)) index = i;
      });
      setPlayingIndex(index);
    };
    player.addEventListener('frameupdate', onFrame);
    return () => player.removeEventListener('frameupdate', onFrame);
  }, [timeline]);

  // --- Editing -------------------------------------------------------------

  const update = (patch: Partial<Storyboard>) => setDraft((d) => ({...d, ...patch}));
  const setScenes = (fn: (scenes: Scene[]) => Scene[]) => setDraft((d) => ({...d, scenes: fn(d.scenes)}));

  const selectScene = (id: string | undefined) => {
    setSelectedId(id);
    const index = valid.scenes.findIndex((s) => s.id === id);
    const timing = timeline.scenes[index];
    if (!timing) return;
    // Land a moment after the transition so the scene's content is visible.
    const settle = Math.min(timing.durationInFrames - 1, timeline.transitionFrames + 24);
    playerRef.current?.seekTo(timing.from + settle);
  };

  const addScene = (template: TemplateId) => {
    const scene = defaultScene(template);
    if (template === 'image' && images.length && !images.includes('images/mountains.svg')) {
      (scene as Extract<Scene, {template: 'image'}>).src = images[0];
    }
    setScenes((scenes) => {
      const at = scenes.findIndex((s) => s.id === selectedId);
      const next = [...scenes];
      next.splice(at === -1 ? scenes.length : at + 1, 0, scene);
      return next;
    });
    setSelectedId(scene.id);
  };

  const moveScene = (from: number, to: number) => {
    if (from === to || to < 0 || to >= draft.scenes.length) return;
    setScenes((scenes) => {
      const next = [...scenes];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const duplicateScene = (index: number) => {
    const copy = {...draft.scenes[index], id: newSceneId()};
    setScenes((scenes) => [...scenes.slice(0, index + 1), copy, ...scenes.slice(index + 1)]);
    setSelectedId(copy.id);
  };

  const deleteScene = (index: number) => {
    if (draft.scenes.length <= 1) return;
    const neighbour = draft.scenes[index + 1] ?? draft.scenes[index - 1];
    setScenes((scenes) => scenes.filter((_, i) => i !== index));
    setSelectedId(neighbour?.id);
  };

  // --- Actions -------------------------------------------------------------

  const save = useCallback(async () => {
    if (!validation.ok) {
      setNotice({kind: 'error', text: 'Fix the problems below before saving.'});
      return;
    }
    try {
      const res = await api.saveStoryboard(name, validation.storyboard);
      setName(res.name);
      setSavedJson(JSON.stringify(draft));
      localStorage.setItem(LAST_OPENED, res.name);
      setNames((await api.listStoryboards()).names);
      setNotice({kind: 'ok', text: `Saved storyboards/${res.name}.json`});
    } catch (err) {
      fail(err);
    }
  }, [validation, name, draft, fail]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const confirmDiscard = () => !dirty || window.confirm('Discard unsaved changes to this storyboard?');

  const generate = async () => {
    if (!concept.trim() || !confirmDiscard()) return;
    setBusy('generate');
    setAttempts([]);
    setNotice({kind: 'info', text: `Asking ${model || 'the local model'} for a storyboard…`});
    try {
      const res = await api.generate({
        concept,
        model: model || undefined,
        theme: ideaTheme === 'auto' ? undefined : ideaTheme,
        seconds: ideaSeconds,
      });
      setAttempts(res.attempts);
      // Keep the current look-and-sound settings; the model only writes content.
      const storyboard = {
        ...res.storyboard,
        transition: draft.transition,
        voiceover: draft.voiceover,
        captions: draft.captions,
      };
      adopt(storyboard, slugify(storyboard.title), false);
      const tries = res.attempts.length;
      setNotice({
        kind: 'ok',
        text: `${res.model} wrote ${storyboard.scenes.length} scenes${tries > 1 ? ` (valid on attempt ${tries})` : ''}. Review, then save or export.`,
      });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const makeVoiceover = async () => {
    if (!validation.ok) return;
    setBusy('voiceover');
    try {
      const res = await api.voiceover(name, validation.storyboard);
      // Merge only the audio, by scene id, so edits made while it spoke survive.
      // Audio is ignored automatically if its narration has since changed.
      const audioById = new Map(res.storyboard.scenes.map((s) => [s.id, s.audio]));
      setDraft((d) => ({
        ...d,
        scenes: d.scenes.map((s) => {
          if (!audioById.has(s.id)) return s;
          const audio = audioById.get(s.id);
          if (audio) return {...s, audio};
          const {audio: _none, ...rest} = s;
          return rest as Scene;
        }),
      }));
      setNotice({kind: 'ok', text: 'Voiceover ready. Scene lengths now match the audio.'});
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const exportVideo = async (target: Aspect) => {
    if (!validation.ok) {
      setNotice({kind: 'error', text: 'Fix the problems below before exporting.'});
      return;
    }
    // Opening another storyboard bumps the generation and stops this loop.
    const generation = generationRef.current;
    const current = () => generation === generationRef.current;
    try {
      let job = await api.startRender(name, validation.storyboard, target);
      if (current()) setJobs((j) => ({...j, [target]: job}));
      while (current() && job.status !== 'done' && job.status !== 'error') {
        await new Promise((r) => setTimeout(r, 600));
        job = await api.renderStatus(job.id);
        if (current()) setJobs((j) => ({...j, [target]: job}));
      }
    } catch (err) {
      if (!current()) return;
      setJobs((j) => ({...j, [target]: undefined}));
      fail(err);
    }
  };

  const upload = async (file: File) => {
    try {
      const {src} = await api.uploadImage(file);
      setImages((await api.listImages()).images);
      return src;
    } catch (err) {
      fail(err);
      return undefined;
    }
  };

  const applyJson = () => {
    if (jsonText === null) return;
    try {
      const result = validateStoryboard(JSON.parse(jsonText));
      if (!result.ok) {
        setNotice({kind: 'error', text: 'That JSON is not a valid storyboard.', details: result.errors});
        return;
      }
      setDraft(result.storyboard);
      setSelectedId(result.storyboard.scenes[0]?.id);
      setJsonText(null);
      setNotice({kind: 'ok', text: 'JSON applied.'});
    } catch (err) {
      setNotice({kind: 'error', text: `Not valid JSON: ${(err as Error).message}`});
    }
  };

  // --- Render --------------------------------------------------------------

  const size = ASPECTS[aspect];
  const inputProps = useMemo(() => ({storyboard: valid, aspect}), [valid, aspect]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▶</span> Video Studio
        </div>
        <div className="file">
          <select
            aria-label="Open storyboard"
            value=""
            onChange={(e) => {
              if (e.target.value && confirmDiscard()) void open(e.target.value);
            }}
          >
            <option value="">Open…</option>
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            className="btn"
            onClick={() => {
              if (confirmDiscard()) adopt(emptyStoryboard(), 'untitled', false);
            }}
          >
            New
          </button>
          <input
            className="name"
            aria-label="File name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setName(slugify(name))}
            spellCheck={false}
          />
          <span className="ext">.json</span>
          <button className="btn primary" onClick={() => void save()} disabled={!dirty && savedJson !== ''}>
            {dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </header>

      {notice ? (
        <div className={`notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          <div>
            <span className="notice-text">{notice.text}</span>
            {notice.details?.length ? (
              <ul>
                {notice.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <button className="icon" aria-label="Dismiss" onClick={() => setNotice(null)}>
            ✕
          </button>
        </div>
      ) : null}

      <main className="columns">
        {/* ---------------- Left: idea + scenes ---------------- */}
        <section className="col col-left">
          <div className="card idea">
            <h2>Idea → video</h2>
            <textarea
              rows={3}
              placeholder="Type a concept, e.g. “Why I started baking sourdough, in 30 seconds”"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
            />
            <div className="row">
              <select aria-label="Model" value={model} onChange={(e) => setModel(e.target.value)}>
                {models.length === 0 ? <option value="">no models found</option> : null}
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select aria-label="Theme" value={ideaTheme} onChange={(e) => setIdeaTheme(e.target.value as ThemeId | 'auto')}>
                <option value="auto">Any theme</option>
                {THEME_IDS.map((t) => (
                  <option key={t} value={t}>
                    {themes[t].name}
                  </option>
                ))}
              </select>
              <select aria-label="Length" value={ideaSeconds} onChange={(e) => setIdeaSeconds(Number(e.target.value))}>
                {[15, 30, 45, 60].map((s) => (
                  <option key={s} value={s}>
                    ~{s}s
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn primary block"
              onClick={() => void generate()}
              disabled={busy !== null || !concept.trim() || models.length === 0}
            >
              {busy === 'generate' ? 'Writing storyboard…' : 'Write storyboard with Ollama'}
            </button>
            {modelError ? <p className="hint error-text">{modelError}</p> : null}
            {attempts.some((a) => !a.ok) ? (
              <details className="attempts">
                <summary>
                  {attempts.filter((a) => !a.ok).length} invalid attempt(s) were retried
                </summary>
                {attempts
                  .filter((a) => !a.ok)
                  .map((a) => (
                    <div key={a.attempt}>
                      <strong>Attempt {a.attempt}</strong>
                      <ul>
                        {a.errors.slice(0, 5).map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </details>
            ) : null}
          </div>

          <div className="card scenes">
            <div className="card-head">
              <h2>Scenes</h2>
              <span className="muted">
                {draft.scenes.length} · {formatSeconds(timeline.totalFrames / FPS)}
              </span>
            </div>
            <ol className="scene-list">
              {draft.scenes.map((scene, i) => (
                <li
                  key={scene.id}
                  className={[
                    'scene-item',
                    scene.id === selected?.id ? 'selected' : '',
                    dragIndex === i ? 'dragging' : '',
                    dropIndex === i && dragIndex !== null && dragIndex !== i ? 'drop-target' : '',
                  ].join(' ')}
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(i);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropIndex(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null) moveScene(dragIndex, i);
                    setDragIndex(null);
                    setDropIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDropIndex(null);
                  }}
                >
                  <button className="scene-main" onClick={() => selectScene(scene.id)}>
                    <span className="grip" aria-hidden>
                      ⋮⋮
                    </span>
                    <span className="scene-index">{valid.scenes[playingIndex]?.id === scene.id ? '▶' : i + 1}</span>
                    <span className="scene-text">
                      <span className={`badge badge-${scene.template}`}>{TEMPLATE_LABELS[scene.template]}</span>
                      <span className="scene-summary">{sceneSummary(scene) || '—'}</span>
                    </span>
                    <span className="scene-duration">
                      {timingFor(scene.id) ? formatSeconds(timingFor(scene.id)!.durationInFrames / FPS) : ''}
                    </span>
                  </button>
                  {scene.id === selected?.id ? (
                    <div className="scene-actions">
                      <button className="icon" title="Move up" disabled={i === 0} onClick={() => moveScene(i, i - 1)}>
                        ↑
                      </button>
                      <button
                        className="icon"
                        title="Move down"
                        disabled={i === draft.scenes.length - 1}
                        onClick={() => moveScene(i, i + 1)}
                      >
                        ↓
                      </button>
                      <button className="icon" title="Duplicate" onClick={() => duplicateScene(i)}>
                        ⧉
                      </button>
                      <button
                        className="icon danger"
                        title="Delete"
                        disabled={draft.scenes.length <= 1}
                        onClick={() => deleteScene(i)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
            <select
              className="add-scene"
              aria-label="Add scene"
              value=""
              onChange={(e) => {
                if (e.target.value) addScene(e.target.value as TemplateId);
              }}
            >
              <option value="">+ Add scene…</option>
              {TEMPLATE_IDS.map((t) => (
                <option key={t} value={t}>
                  {TEMPLATE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* ---------------- Middle: editor ---------------- */}
        <section className="col col-mid">
          <div className="card">
            <h2>Video</h2>
            <div className="form-grid">
              <label className="field wide">
                <span className="field-label">Title</span>
                <input value={draft.title} onChange={(e) => update({title: e.target.value})} />
              </label>
              <div className="field wide">
                <span className="field-label">Theme</span>
                <div className="theme-picker">
                  {THEME_IDS.map((id) => {
                    const t = themes[id];
                    return (
                      <button
                        key={id}
                        className={`theme-chip${draft.theme === id ? ' active' : ''}`}
                        onClick={() => update({theme: id})}
                        aria-pressed={draft.theme === id}
                      >
                        <span className="swatch" style={{background: t.colors.bg, color: t.colors.ink}}>
                          <span style={{fontFamily: t.fonts.heading, fontWeight: t.headingWeight}}>Aa</span>
                          <i style={{background: t.colors.accent}} />
                        </span>
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="field">
                <span className="field-label">Transition</span>
                <select
                  value={draft.transition.type}
                  onChange={(e) =>
                    update({transition: {...draft.transition, type: e.target.value as Storyboard['transition']['type']}})
                  }
                >
                  {TRANSITION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Transition length</span>
                <select
                  value={draft.transition.duration}
                  disabled={draft.transition.type === 'none'}
                  onChange={(e) => update({transition: {...draft.transition, duration: Number(e.target.value)}})}
                >
                  {[...new Set([0.3, 0.5, 0.8, 1.2, draft.transition.duration])].sort().map((d) => (
                    <option key={d} value={d}>
                      {d}s
                    </option>
                  ))}
                </select>
              </label>
              <div className="field wide toggles">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={draft.captions}
                    onChange={(e) => update({captions: e.target.checked})}
                  />
                  Burned-in captions
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={draft.voiceover.enabled}
                    onChange={(e) => update({voiceover: {...draft.voiceover, enabled: e.target.checked}})}
                  />
                  Voiceover (macOS “say”)
                </label>
              </div>
              {draft.voiceover.enabled ? (
                <>
                  <label className="field">
                    <span className="field-label">Voice</span>
                    <select
                      value={draft.voiceover.voice}
                      onChange={(e) => update({voiceover: {...draft.voiceover, voice: e.target.value}})}
                    >
                      {[...new Set([draft.voiceover.voice, ...voices])].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">
                      Speed <em>{draft.voiceover.rate} wpm</em>
                    </span>
                    <input
                      type="range"
                      min={90}
                      max={360}
                      step={5}
                      value={draft.voiceover.rate}
                      onChange={(e) => update({voiceover: {...draft.voiceover, rate: Number(e.target.value)}})}
                    />
                  </label>
                  <div className="field wide">
                    <button
                      className={`btn${voiceoverStale ? ' primary' : ''}`}
                      onClick={() => void makeVoiceover()}
                      disabled={busy !== null || !validation.ok || !voiceoverStale}
                    >
                      {busy === 'voiceover'
                        ? 'Speaking…'
                        : voiceoverStale
                          ? 'Generate voiceover for preview'
                          : 'Voiceover is up to date'}
                    </button>
                    <p className="hint">
                      Only scenes with narration are spoken. Exports always regenerate stale audio first.
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {selected ? (
            <div className="card">
              <h2>
                Scene {draft.scenes.findIndex((s) => s.id === selected.id) + 1}
              </h2>
              <SceneForm
                scene={selected}
                images={images}
                onUpload={upload}
                onPatch={(id, patch) =>
                  setScenes((scenes) => scenes.map((s) => (s.id === id ? ({...s, ...patch} as Scene) : s)))
                }
              />
            </div>
          ) : null}

          {!validation.ok ? (
            <div className="card problems" role="alert">
              <h2>Problems ({validation.errors.length})</h2>
              <p className="hint">The preview shows the last valid version until these are fixed.</p>
              <ul>
                {validation.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <details
            className="card json"
            onToggle={(e) => {
              if (!(e.target as HTMLDetailsElement).open) setJsonText(null);
            }}
          >
            <summary>Storyboard JSON</summary>
            <textarea
              className="mono"
              rows={16}
              spellCheck={false}
              value={jsonText ?? JSON.stringify(draft, null, 2)}
              onChange={(e) => setJsonText(e.target.value)}
            />
            <div className="row">
              <button className="btn" onClick={applyJson} disabled={jsonText === null}>
                Apply JSON
              </button>
              <button className="btn" onClick={() => setJsonText(null)} disabled={jsonText === null}>
                Revert
              </button>
            </div>
          </details>
        </section>

        {/* ---------------- Right: preview + export ---------------- */}
        <section className="col col-right">
          <div className="card preview">
            <div className="card-head">
              <h2>Preview</h2>
              <div className="segmented" role="group" aria-label="Preview aspect ratio">
                {(Object.keys(ASPECTS) as Aspect[]).map((a) => (
                  <button key={a} className={aspect === a ? 'active' : ''} onClick={() => setAspect(a)}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className={`stage stage-${aspect === '16:9' ? 'wide' : 'tall'}`}>
              <Player
                ref={playerRef}
                component={StoryboardVideo}
                inputProps={inputProps}
                durationInFrames={timeline.totalFrames}
                fps={FPS}
                compositionWidth={size.width}
                compositionHeight={size.height}
                controls
                loop
                acknowledgeRemotionLicense
                style={{width: '100%', aspectRatio: `${size.width} / ${size.height}`}}
              />
            </div>
            <p className="hint">
              {formatSeconds(timeline.totalFrames / FPS)} · {size.width}×{size.height} · {FPS} fps
              {voiceoverStale ? ' · voiceover not generated yet' : ''}
            </p>
          </div>

          <div className="card">
            <h2>Export MP4</h2>
            <div className="exports">
              {(Object.keys(ASPECTS) as Aspect[]).map((a) => {
                const job = jobs[a];
                const running = job && job.status !== 'done' && job.status !== 'error';
                return (
                  <div key={a} className="export">
                    <button className="btn primary block" onClick={() => void exportVideo(a)} disabled={Boolean(running)}>
                      {running ? `${job.status}…` : `Export ${a}`}
                      <small>{a === '16:9' ? 'landscape 1920×1080' : 'vertical 1080×1920'}</small>
                    </button>
                    {running ? (
                      <progress value={job.status === 'rendering' ? job.progress : undefined} max={1} />
                    ) : null}
                    {job?.status === 'done' ? (
                      <p className="hint ok-text">
                        ✓ <code>{job.file}</code> ·{' '}
                        <a href={job.url} target="_blank" rel="noreferrer">
                          open
                        </a>
                      </p>
                    ) : null}
                    {job?.status === 'error' ? <p className="hint error-text">{job.error}</p> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
