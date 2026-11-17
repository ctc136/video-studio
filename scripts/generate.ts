import fs from 'node:fs/promises';
import path from 'node:path';
import {FPS, THEME_IDS, type ThemeId, slugify} from '../src/shared/schema';
import {buildTimeline} from '../src/shared/timeline';
import {generateStoryboard} from '../server/ollama';
import {STORYBOARD_DIR} from '../server/paths';
import {fail, parseArgs} from './cli';

const {positional, flags} = parseArgs(process.argv.slice(2));
const concept = positional.join(' ');
if (!concept) {
  fail('Usage: npm run generate -- "your concept" [--theme notebook|midnight|sunrise] [--seconds 30] [--model gemma3] [--name file-name]');
}
const theme = typeof flags.theme === 'string' ? flags.theme : undefined;
if (theme && !(THEME_IDS as readonly string[]).includes(theme)) {
  fail(`Unknown theme "${theme}". Use one of: ${THEME_IDS.join(', ')}`);
}

try {
  const {storyboard, model} = await generateStoryboard({
    concept,
    theme: theme as ThemeId | undefined,
    model: typeof flags.model === 'string' ? flags.model : undefined,
    seconds: typeof flags.seconds === 'string' ? Number(flags.seconds) : undefined,
    onAttempt: ({attempt, ok, errors}) => {
      console.log(ok ? `Attempt ${attempt}: valid` : `Attempt ${attempt}: invalid, retrying`);
      for (const error of errors.slice(0, 6)) console.log(`    - ${error}`);
    },
  });
  const name = slugify(typeof flags.name === 'string' ? flags.name : storyboard.title);
  const file = path.join(STORYBOARD_DIR, `${name}.json`);
  await fs.writeFile(file, JSON.stringify(storyboard, null, 2) + '\n');
  const seconds = buildTimeline(storyboard).totalFrames / FPS;
  console.log(`\n✓ ${model} wrote ${storyboard.scenes.length} scenes (${seconds.toFixed(1)}s) to storyboards/${name}.json`);
  console.log(`  Render it:  npm run render -- storyboards/${name}.json --aspect both`);
} catch (err) {
  fail((err as Error).message);
}
