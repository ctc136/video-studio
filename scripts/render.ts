import path from 'node:path';
import {ASPECTS, type Aspect} from '../src/shared/schema';
import {bundleProject, outputFileFor, renderStoryboard} from '../server/render';
import {fail, loadStoryboardFile, parseArgs} from './cli';

const {positional, flags} = parseArgs(process.argv.slice(2));
const file = positional[0];
if (!file) {
  fail('Usage: npm run render -- storyboards/<name>.json [--aspect 16:9|9:16|both] [--out file.mp4]');
}

const aspectFlag = typeof flags.aspect === 'string' ? flags.aspect : '16:9';
const aspects: Aspect[] =
  aspectFlag === 'both' ? ['16:9', '9:16'] : aspectFlag in ASPECTS ? [aspectFlag as Aspect] : [];
if (aspects.length === 0) fail(`Unknown aspect "${aspectFlag}". Use 16:9, 9:16 or both.`);
if (typeof flags.out === 'string' && aspects.length > 1) fail('--out only works with a single aspect.');

const storyboard = await loadStoryboardFile(file);
const name = path.basename(file, path.extname(file));

console.log('Bundling...');
const serveUrl = await bundleProject();

for (const aspect of aspects) {
  const outFile = typeof flags.out === 'string' ? path.resolve(flags.out) : outputFileFor(name, aspect);
  let last = -1;
  await renderStoryboard({
    storyboard,
    aspect,
    outFile,
    serveUrl,
    onProgress: ({stage, progress}) => {
      const percent = Math.floor(progress * 10) * 10;
      if (stage === 'rendering' && percent !== last) {
        last = percent;
        console.log(`  ${aspect} ${percent}%`);
      }
    },
  });
  console.log(`✓ ${path.relative(process.cwd(), outFile)}`);
}
