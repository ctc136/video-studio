import fs from 'node:fs/promises';
import path from 'node:path';
import type {Storyboard} from '../src/shared/schema';
import {PUBLIC_DIR} from './paths';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];

/** Images under public/images, as paths relative to public/. */
export async function listImages(): Promise<string[]> {
  const dir = path.join(PUBLIC_DIR, 'images');
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  return entries
    .filter((f) => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => `images/${f}`);
}

/** Resolve a public-relative path, refusing anything that escapes public/. */
export function resolvePublic(relative: string): string | null {
  const full = path.resolve(PUBLIC_DIR, relative);
  return full.startsWith(PUBLIC_DIR + path.sep) ? full : null;
}

/** Errors for local image files a storyboard points at that do not exist. */
export async function checkAssets(storyboard: Storyboard): Promise<string[]> {
  const errors: string[] = [];
  let available: string[] | undefined;
  for (const [i, scene] of storyboard.scenes.entries()) {
    if (scene.template !== 'image' || /^https?:\/\//.test(scene.src)) continue;
    const full = resolvePublic(scene.src);
    const exists = full ? await fs.stat(full).then((s) => s.isFile(), () => false) : false;
    if (!exists) {
      available ??= await listImages();
      errors.push(
        `scenes[${i}].src (image scene): "${scene.src}" does not exist in public/. ` +
          (available.length
            ? `Available images: ${available.join(', ')}`
            : 'There are no images available, so use a different template.'),
      );
    }
  }
  return errors;
}
