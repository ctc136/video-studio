import fs from 'node:fs/promises';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {type Aspect, type Storyboard, slugify} from '../src/shared/schema';
import {OUT_DIR, PUBLIC_DIR, REMOTION_ENTRY} from './paths';

export type RenderProgress = {stage: 'bundling' | 'rendering'; progress: number};

export const outputFileFor = (name: string, aspect: Aspect) =>
  path.join(OUT_DIR, `${slugify(name)}-${aspect.replace(':', 'x')}.mp4`);

/**
 * Bundle the Remotion project. Done per render batch (not once per process)
 * so that newly added images and voiceover files in public/ are included.
 */
export async function bundleProject(onProgress?: (percent: number) => void) {
  return bundle({
    entryPoint: REMOTION_ENTRY,
    publicDir: PUBLIC_DIR,
    onProgress,
  });
}

export async function renderStoryboard(options: {
  storyboard: Storyboard;
  aspect: Aspect;
  outFile: string;
  /** Reuse a bundle when rendering several aspect ratios in a row. */
  serveUrl?: string;
  onProgress?: (p: RenderProgress) => void;
}): Promise<string> {
  const {storyboard, aspect, outFile, onProgress} = options;
  await fs.mkdir(path.dirname(outFile), {recursive: true});

  const ownBundle = !options.serveUrl;
  const serveUrl =
    options.serveUrl ??
    (await bundleProject((percent) => onProgress?.({stage: 'bundling', progress: percent / 100})));

  try {
    const inputProps = {storyboard, aspect};
    const composition = await selectComposition({serveUrl, id: 'Storyboard', inputProps});
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: outFile,
      inputProps,
      onProgress: ({progress}) => onProgress?.({stage: 'rendering', progress}),
    });
    return outFile;
  } finally {
    // Each bundle is a full copy of public/ in a temp folder: don't leave it behind.
    if (ownBundle) await fs.rm(serveUrl, {recursive: true, force: true});
  }
}
