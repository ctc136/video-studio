import fs from 'node:fs/promises';
import path from 'node:path';
import {type Storyboard, validateStoryboard} from '../src/shared/schema';

/** Read and validate a storyboard file, exiting with readable errors. */
export async function loadStoryboardFile(file: string): Promise<Storyboard> {
  let raw: string;
  try {
    raw = await fs.readFile(path.resolve(file), 'utf8');
  } catch {
    fail(`Cannot read ${file}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    fail(`${file} is not valid JSON: ${(err as Error).message}`);
  }
  const result = validateStoryboard(json);
  if (!result.ok) {
    fail(`${file} is not a valid storyboard:\n${result.errors.map((e) => `  - ${e}`).join('\n')}`);
  }
  return result.storyboard;
}

export function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

/** Tiny flag parser: `--name value` and `--flag`. */
export function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[arg.slice(2)] = next;
        i++;
      } else {
        flags[arg.slice(2)] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return {positional, flags};
}
