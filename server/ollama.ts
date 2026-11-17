import {STORYBOARD_GUIDE} from '../src/shared/guide';
import {
  type Storyboard,
  THEME_IDS,
  type ThemeId,
  validateStoryboard,
} from '../src/shared/schema';
import {checkAssets, listImages} from './assets';

const OLLAMA_URL = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
export const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? 'gemma3';
const MAX_ATTEMPTS = 4;
const SAMPLE_IMAGE = 'images/mountains.svg';

type Message = {role: 'system' | 'user' | 'assistant'; content: string};

export type GenerateAttempt = {attempt: number; ok: boolean; errors: string[]};
export type GenerateResult = {storyboard: Storyboard; attempts: GenerateAttempt[]; model: string};

export class OllamaError extends Error {}

export async function listModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {signal: AbortSignal.timeout(3000)});
    const json = (await res.json()) as {models?: {name: string}[]};
    return (json.models ?? []).map((m) => m.name);
  } catch {
    throw new OllamaError(`Cannot reach Ollama at ${OLLAMA_URL}. Start it with "ollama serve".`);
  }
}

/**
 * A loose JSON schema for Ollama's structured output. It pins down only the
 * top level, because without it small models often answer with an empty
 * object. Scenes are left as free-form objects on purpose: constraining their
 * fields makes the model skip the optional ones. The real per-template rules
 * are enforced afterwards by validateStoryboard(), with retries.
 */
export const OUTPUT_SHAPE = {
  type: 'object',
  properties: {
    title: {type: 'string'},
    theme: {type: 'string', enum: [...THEME_IDS]},
    scenes: {type: 'array', minItems: 3, items: {type: 'object'}},
  },
  required: ['title', 'theme', 'scenes'],
};

async function chat(model: string, messages: Message[]): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({model, messages, stream: false, format: OUTPUT_SHAPE, options: {temperature: 0.7}}),
      signal: AbortSignal.timeout(240_000),
    });
  } catch (err) {
    const timedOut = (err as Error).name === 'TimeoutError';
    throw new OllamaError(
      timedOut
        ? `Ollama took too long to answer with "${model}".`
        : `Cannot reach Ollama at ${OLLAMA_URL}. Start it with "ollama serve".`,
    );
  }
  if (!res.ok) {
    const body = await res.text();
    throw new OllamaError(
      res.status === 404
        ? `Ollama does not have the model "${model}". Run: ollama pull ${model}`
        : `Ollama error ${res.status}: ${body.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as {message?: {content?: string}};
  return json.message?.content ?? '';
}

/** Pull the JSON object out of a model reply, tolerating fences and chatter. */
export function extractJson(reply: string): unknown {
  const text = reply.replace(/```(?:json)?/gi, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('reply contained no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Near-miss template names small models reach for. */
const TEMPLATE_ALIASES: Record<string, string> = {
  bullet: 'bullets',
  list: 'bullets',
  bullet_reveal: 'bullets',
  stats: 'stat',
  statistic: 'stat',
  counter: 'stat',
  number: 'stat',
  kinetic_text: 'kinetic',
  text: 'kinetic',
  title_card: 'title',
  intro: 'title',
  outro_card: 'outro',
  end: 'outro',
  graph: 'chart',
  bar: 'chart',
  line: 'chart',
  code: 'terminal',
  console: 'terminal',
  photo: 'image',
};

const toNumber = (v: unknown) => {
  if (typeof v !== 'string') return v;
  const n = Number(v.replace(/[^0-9.+-]/g, ''));
  return v.trim() !== '' && Number.isFinite(n) ? n : v;
};

/**
 * Fix the harmless mistakes small models make (numbers as strings, a wrapper
 * object, out-of-range durations) so retries are spent on real problems.
 */
export function tidy(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const root = isRecord(raw.storyboard) ? raw.storyboard : raw;
  if (!Array.isArray(root.scenes)) return root;
  const scenes = root.scenes.map((scene) => {
    if (!isRecord(scene)) return scene;
    const out: Record<string, unknown> = {...scene};
    delete out.audio;
    delete out.id;
    if (typeof out.template === 'string') {
      const template = out.template.trim().toLowerCase().replace(/[\s-]+/g, '_');
      out.template = TEMPLATE_ALIASES[template] ?? template;
    }
    // "% of tools unused" as a label means the percent sign is the suffix.
    if (out.template === 'stat' && typeof out.label === 'string' && !out.suffix) {
      const percent = out.label.match(/^%\s*(.+)$/);
      if (percent) Object.assign(out, {suffix: '%', label: percent[1]});
    }
    // A percent sign goes after the number, whatever the model thinks.
    if (out.template === 'stat' && out.prefix === '%' && !out.suffix) {
      delete out.prefix;
      out.suffix = '%';
    }
    const duration = toNumber(out.duration);
    out.duration = typeof duration === 'number' ? Math.min(12, Math.max(2, duration)) : duration;
    if ('value' in out) out.value = toNumber(out.value);
    // Emphasis marks belong on screen, not in the spoken line.
    if (typeof out.narration === 'string') out.narration = out.narration.replace(/\*/g, '');
    if (Array.isArray(out.data)) {
      out.data = out.data.map((d) => (isRecord(d) ? {...d, label: String(d.label ?? ''), value: toNumber(d.value)} : d));
    }
    for (const key of Object.keys(out)) {
      if (out[key] === null || out[key] === '') delete out[key];
    }
    return out;
  });
  // The model only writes content; look and sound settings stay with the user.
  return {title: root.title, theme: root.theme, scenes};
}

export async function generateStoryboard(options: {
  concept: string;
  model?: string;
  theme?: ThemeId;
  seconds?: number;
  onAttempt?: (attempt: GenerateAttempt) => void;
}): Promise<GenerateResult> {
  const concept = options.concept.trim();
  if (!concept) throw new OllamaError('Type a concept first.');
  const model = options.model || DEFAULT_MODEL;
  const seconds = Math.min(120, Math.max(10, options.seconds ?? 30));
  // The bundled sample image is not offered: models use it whether it fits or not.
  const images = (await listImages()).filter((src) => src !== SAMPLE_IMAGE);

  const messages: Message[] = [
    {role: 'system', content: STORYBOARD_GUIDE},
    {
      role: 'user',
      content: [
        `Write a storyboard for this video concept:\n"""\n${concept}\n"""`,
        `Target length: about ${seconds} seconds (${Math.round(seconds / 4.5)} scenes or so).`,
        options.theme ? `Use the theme "${options.theme}".` : `Pick the best theme from: ${THEME_IDS.join(', ')}.`,
        images.length
          ? `Image files you may use in "image" scenes (use the exact path): ${images.join(', ')}. Only use one if it fits the concept.`
          : 'There are no image files, so do NOT use the "image" template.',
        'Reply with the JSON object only.',
      ].join('\n'),
    },
  ];

  const attempts: GenerateAttempt[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const reply = await chat(model, messages);
    let errors: string[];
    try {
      const candidate = tidy(extractJson(reply));
      if (options.theme && isRecord(candidate)) candidate.theme = options.theme;
      const result = validateStoryboard(candidate);
      if (result.ok) {
        errors = await checkAssets(result.storyboard);
        result.storyboard.scenes.forEach((scene, i) => {
          if (scene.template === 'image' && !images.includes(scene.src)) {
            errors.push(`scenes[${i}] (image scene): there is no suitable image, use a different template`);
          }
        });
        if (errors.length === 0) {
          const done = {attempt, ok: true, errors: []};
          attempts.push(done);
          options.onAttempt?.(done);
          return {storyboard: result.storyboard, attempts, model};
        }
      } else {
        errors = result.errors;
      }
    } catch (err) {
      errors = [`The reply was not valid JSON: ${(err as Error).message}`];
    }

    const failed = {attempt, ok: false, errors};
    attempts.push(failed);
    options.onAttempt?.(failed);
    messages.push(
      {role: 'assistant', content: reply.slice(0, 6000)},
      {
        role: 'user',
        content:
          `That storyboard is invalid. Fix these problems and reply with the COMPLETE corrected JSON object only:\n` +
          errors.slice(0, 12).map((e) => `- ${e}`).join('\n'),
      },
    );
  }

  const last = attempts[attempts.length - 1];
  throw new OllamaError(
    `"${model}" did not produce a valid storyboard after ${MAX_ATTEMPTS} attempts. Last problems:\n` +
      last.errors.slice(0, 6).map((e) => `- ${e}`).join('\n'),
  );
}
