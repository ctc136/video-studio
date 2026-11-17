import {FPS} from '../src/shared/schema';
import {buildTimeline} from '../src/shared/timeline';
import {fail, loadStoryboardFile, parseArgs} from './cli';

const {positional} = parseArgs(process.argv.slice(2));
if (positional.length === 0) fail('Usage: npm run validate -- storyboards/<name>.json');

for (const file of positional) {
  const storyboard = await loadStoryboardFile(file);
  const seconds = buildTimeline(storyboard).totalFrames / FPS;
  console.log(
    `✓ ${file}: ${storyboard.scenes.length} scenes, ${seconds.toFixed(1)}s, theme "${storyboard.theme}"`,
  );
}
