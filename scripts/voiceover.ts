import fs from 'node:fs/promises';
import path from 'node:path';
import {FPS} from '../src/shared/schema';
import {buildTimeline} from '../src/shared/timeline';
import {synthesizeVoiceover} from '../server/tts';
import {fail, loadStoryboardFile, parseArgs} from './cli';

// Speaks every scene's narration with macOS `say` and writes the audio
// references back into the storyboard file, so previews can play them.
const {positional} = parseArgs(process.argv.slice(2));
const file = positional[0];
if (!file) fail('Usage: npm run voiceover -- storyboards/<name>.json');

const storyboard = await loadStoryboardFile(file);
if (!storyboard.voiceover.enabled) {
  fail(`Voiceover is off in ${file}. Set "voiceover": {"enabled": true} first.`);
}
try {
  const spoken = await synthesizeVoiceover(storyboard, path.basename(file, path.extname(file)));
  await fs.writeFile(path.resolve(file), JSON.stringify(spoken, null, 2) + '\n');
  const lines = spoken.scenes.filter((s) => s.audio).length;
  const seconds = buildTimeline(spoken).totalFrames / FPS;
  console.log(`✓ ${lines} lines spoken by ${spoken.voiceover.voice}. Video is now ${seconds.toFixed(1)}s.`);
} catch (err) {
  fail((err as Error).message);
}
