import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const OUT_DIR = path.join(ROOT, 'out');
export const STORYBOARD_DIR = path.join(ROOT, 'storyboards');
export const REMOTION_ENTRY = path.join(ROOT, 'src', 'remotion', 'index.ts');
