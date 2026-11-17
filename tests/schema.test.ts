import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {FPS, audioKey, parseStoryboard, validateStoryboard} from '../src/shared/schema';
import {buildTimeline, splitCaption} from '../src/shared/timeline';

const sample = JSON.parse(fs.readFileSync(new URL('../storyboards/sample.json', import.meta.url), 'utf8'));

test('sample storyboard is valid and gets scene ids', () => {
  const result = validateStoryboard(sample);
  assert.ok(result.ok);
  assert.equal(result.storyboard.scenes.length, 8);
  assert.equal(new Set(result.storyboard.scenes.map((s) => s.id)).size, 8);
});

test('errors name the scene, the field and the fix', () => {
  const result = validateStoryboard({
    title: 'x',
    theme: 'neon',
    scenes: [
      {template: 'title', duration: 3},
      {template: 'slideshow', duration: 3},
      {template: 'bullets', duration: 99, items: []},
      {template: 'image', duration: 3, src: '../secrets.png'},
    ],
  });
  assert.ok(!result.ok);
  const text = result.errors.join('\n');
  assert.match(text, /theme: must be one of: notebook, midnight, sunrise/);
  assert.match(text, /scenes\[0\]\.title \(title scene\): is required/);
  assert.match(text, /scenes\[1\]\.template: "slideshow" is not a template\. Use one of: title,/);
  assert.match(text, /scenes\[2\]\.duration \(bullets scene\): must be at most 30 seconds/);
  assert.match(text, /scenes\[2\]\.items \(bullets scene\): needs at least 1 item/);
  assert.match(text, /scenes\[3\]\.src \(image scene\): must be an http/);
});

test('non-objects are rejected without throwing', () => {
  for (const input of [null, 'hi', 42, []]) {
    assert.equal(validateStoryboard(input).ok, false);
  }
});

test('timeline overlaps scenes by the transition length', () => {
  const storyboard = parseStoryboard(sample);
  const timeline = buildTimeline(storyboard);
  const sum = storyboard.scenes.reduce((n, s) => n + Math.round(s.duration * FPS), 0);
  assert.equal(timeline.transitionFrames, 15);
  assert.equal(timeline.totalFrames, sum - 15 * (storyboard.scenes.length - 1));
  assert.equal(timeline.scenes[1].from, timeline.scenes[0].durationInFrames - 15);
});

test('voiceover stretches scenes and never overlaps lines', () => {
  const storyboard = parseStoryboard(sample);
  storyboard.voiceover.enabled = true;
  const {voice, rate} = storyboard.voiceover;
  for (const scene of storyboard.scenes) {
    scene.audio = {src: 'voiceover/x.wav', duration: 6, key: audioKey(scene.narration!, voice, rate)};
  }
  const timeline = buildTimeline(storyboard);
  timeline.scenes.forEach((scene, i) => {
    assert.ok(scene.audio);
    assert.ok(scene.durationInFrames >= 6 * FPS);
    const next = timeline.scenes[i + 1]?.audio;
    if (next) assert.ok(scene.audio.from + scene.audio.durationInFrames <= next.from);
  });
  const last = timeline.scenes.at(-1)!;
  assert.ok(last.audio!.from + last.audio!.durationInFrames <= timeline.totalFrames);
});

test('stale audio is ignored', () => {
  const storyboard = parseStoryboard(sample);
  storyboard.voiceover.enabled = true;
  storyboard.scenes[0].audio = {src: 'voiceover/x.wav', duration: 20, key: 'old'};
  assert.equal(buildTimeline(storyboard).scenes[0].audio, undefined);
});

test('captions cover every narrated scene in order', () => {
  const storyboard = parseStoryboard({...sample, captions: true});
  const {captions, totalFrames} = buildTimeline(storyboard);
  assert.ok(captions.length >= storyboard.scenes.length);
  captions.forEach((cue, i) => {
    assert.ok(cue.to > cue.from);
    assert.ok(cue.to <= totalFrames);
    if (i > 0) assert.ok(cue.from >= captions[i - 1].to);
  });
});

test('splitCaption keeps lines short and loses no words', () => {
  const text = 'I used to think a terminal was where planes parked. Now I ship things, mostly on purpose.';
  const chunks = splitCaption(text);
  assert.equal(chunks.join(' '), text);
  assert.ok(chunks.every((c) => c.length <= 38));
});

test('tidy repairs the usual small-model mistakes', async () => {
  const {tidy, extractJson} = await import('../server/ollama');
  const reply = '```json\n{"storyboard": {"title": "T", "theme": "midnight", "voiceover": {"enabled": true}, "scenes": [' +
    '{"template": "Bullet", "duration": "5 seconds", "items": ["a"], "narration": "Say *this*", "heading": null},' +
    '{"template": "stat", "duration": 99, "value": "75%", "label": "% of tools unused"}]}}\n```';
  const result = validateStoryboard(tidy(extractJson(reply)));
  assert.ok(result.ok);
  const [bullets, stat] = result.storyboard.scenes;
  assert.equal(bullets.template, 'bullets');
  assert.equal(bullets.duration, 5);
  assert.equal(bullets.narration, 'Say this');
  assert.deepEqual([stat.duration, (stat as any).value, (stat as any).suffix, (stat as any).label], [12, 75, '%', 'of tools unused']);
  // Settings the model should not control are dropped.
  assert.equal(result.storyboard.voiceover.enabled, false);
});
