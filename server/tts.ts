import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import {type Storyboard, audioKey, slugify} from '../src/shared/schema';
import {PUBLIC_DIR} from './paths';

const run = promisify(execFile);

export type Voice = {name: string; locale: string};

/** Voices installed on this Mac, from `say -v '?'`. */
export async function listVoices(): Promise<Voice[]> {
  const {stdout} = await run('say', ['-v', '?']);
  const voices: Voice[] = [];
  for (const line of stdout.split('\n')) {
    const match = line.match(/^(.+?)\s+([a-z]{2}_[A-Z0-9]{2,3})\s+#/);
    if (match) voices.push({name: match[1].trim(), locale: match[2]});
  }
  return voices;
}

/** Length of a PCM WAV file in seconds, read from its header. */
export function wavDuration(buffer: Buffer): number {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a WAV file');
  }
  let byteRate = 0;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === 'fmt ') byteRate = buffer.readUInt32LE(offset + 16);
    if (id === 'data') {
      if (!byteRate) break;
      // Some writers leave the size as 0 or 0xFFFFFFFF: fall back to the file length.
      const dataBytes = Math.min(size || Infinity, buffer.length - offset - 8);
      return dataBytes / byteRate;
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error('WAV file has no audio data');
}

async function speak(text: string, voice: string, rate: number, outFile: string) {
  // Text goes through a file so it can never be read as a command-line flag.
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'video-studio-say-'));
  const input = path.join(tmp, 'line.txt');
  try {
    await fs.writeFile(input, text, 'utf8');
    await run('say', ['-v', voice, '-r', String(rate), '-o', outFile, '--data-format=LEI16@44100', '-f', input]);
  } catch (err) {
    const detail = (err as {stderr?: string}).stderr?.trim() || (err as Error).message;
    throw new Error(`The "say" command failed for voice "${voice}": ${detail}`);
  } finally {
    await fs.rm(tmp, {recursive: true, force: true});
  }
}

/**
 * Make sure every narrated scene has matching audio. Audio files are cached
 * by a hash of (voice, rate, narration), so only changed lines are re-spoken.
 * Returns a new storyboard with `audio` filled in; scene durations stretch
 * automatically in buildTimeline().
 */
export async function synthesizeVoiceover(storyboard: Storyboard, name: string): Promise<Storyboard> {
  if (process.platform !== 'darwin') {
    throw new Error('Voiceover uses the macOS "say" command and only works on a Mac.');
  }
  const {voice, rate} = storyboard.voiceover;
  const relDir = `voiceover/${slugify(name)}`;
  const dir = path.join(PUBLIC_DIR, relDir);
  await fs.mkdir(dir, {recursive: true});

  const keep = new Set<string>();
  const scenes = [];
  for (const scene of storyboard.scenes) {
    const narration = scene.narration?.trim();
    if (!narration) {
      const {audio: _drop, ...rest} = scene;
      scenes.push(rest as typeof scene);
      continue;
    }
    const key = audioKey(narration, voice, rate);
    const file = `${key}.wav`;
    const full = path.join(dir, file);
    keep.add(file);
    const cached = await fs.stat(full).then((s) => s.size > 44, () => false);
    if (!cached) await speak(narration, voice, rate, full);
    const duration = wavDuration(await fs.readFile(full));
    scenes.push({...scene, audio: {src: `${relDir}/${file}`, duration: Math.round(duration * 1000) / 1000, key}});
  }

  // Drop audio for lines that no longer exist.
  for (const file of await fs.readdir(dir)) {
    if (file.endsWith('.wav') && !keep.has(file)) await fs.rm(path.join(dir, file), {force: true});
  }
  return {...storyboard, scenes};
}
