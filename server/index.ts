import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express, {type NextFunction, type Request, type Response} from 'express';
import {createServer as createViteServer} from 'vite';
import {ASPECTS, type Aspect, THEME_IDS, type ThemeId, slugify, validateStoryboard} from '../src/shared/schema';
import {checkAssets, listImages} from './assets';
import {DEFAULT_MODEL, OllamaError, generateStoryboard, listModels} from './ollama';
import {OUT_DIR, PUBLIC_DIR, ROOT, STORYBOARD_DIR} from './paths';
import {outputFileFor, renderStoryboard} from './render';
import {listVoices, pruneMissingAudio, synthesizeVoiceover} from './tts';

const PORT = Number(process.env.PORT ?? 5177);
const HOST = '127.0.0.1';
const UPLOAD_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: string[],
  ) {
    super(message);
  }
}

/** Validate a storyboard from a request body or fail with a 400. */
function requireStoryboard(input: unknown) {
  const result = validateStoryboard(input);
  if (!result.ok) throw new HttpError(400, 'The storyboard is not valid.', result.errors);
  return result.storyboard;
}

const storyboardPath = (name: string) => path.join(STORYBOARD_DIR, `${slugify(name)}.json`);

// --- Render jobs -----------------------------------------------------------

type RenderJob = {
  id: string;
  aspect: Aspect;
  status: 'queued' | 'voiceover' | 'bundling' | 'rendering' | 'done' | 'error';
  progress: number;
  file?: string;
  url?: string;
  error?: string;
};

const jobs = new Map<string, RenderJob>();
// Renders run one at a time: each one already uses every core.
let queue: Promise<void> = Promise.resolve();

/**
 * Run work after everything already queued. Renders and voiceover share this
 * queue because voiceover writes, and cleans up, the folder renders read from.
 */
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function enqueueRender(input: unknown, name: string, aspect: Aspect): RenderJob {
  const job: RenderJob = {id: randomUUID(), aspect, status: 'queued', progress: 0};
  jobs.set(job.id, job);
  // Forget old finished jobs so the map cannot grow forever. Never drop
  // queued or running ones: the UI is still polling them.
  const finished = [...jobs.values()].filter((j) => j.status === 'done' || j.status === 'error');
  for (const old of finished.slice(0, -20)) jobs.delete(old.id);

  void serialized(async () => {
    try {
      let storyboard = requireStoryboard(input);
      const missing = await checkAssets(storyboard);
      if (missing.length) throw new HttpError(400, missing.join('\n'));
      if (storyboard.voiceover.enabled) {
        job.status = 'voiceover';
        storyboard = await synthesizeVoiceover(storyboard, name);
      }
      const outFile = outputFileFor(name, aspect);
      await renderStoryboard({
        storyboard,
        aspect,
        outFile,
        onProgress: ({stage, progress}) => {
          job.status = stage;
          job.progress = progress;
        },
      });
      job.status = 'done';
      job.progress = 1;
      job.file = path.relative(ROOT, outFile);
      job.url = `/out/${path.basename(outFile)}?t=${Date.now()}`;
    } catch (err) {
      const e = err as HttpError;
      job.status = 'error';
      job.error = [e.message, ...(e.errors ?? [])].join('\n');
    }
  });
  return job;
}

// --- App -------------------------------------------------------------------

const app = express();

// This server can write files and run `say`, so only this machine's own pages
// may talk to it: reject foreign Host headers (DNS rebinding) and foreign
// Origins (other websites making requests to localhost).
app.use((req, _res, next) => {
  const allowed = [`localhost:${PORT}`, `127.0.0.1:${PORT}`];
  const origin = req.headers.origin;
  if (!allowed.includes(req.headers.host ?? '')) return next(new HttpError(403, 'Forbidden host'));
  if (origin && !allowed.includes(origin.replace(/^https?:\/\//, ''))) {
    return next(new HttpError(403, 'Forbidden origin'));
  }
  if (req.method !== 'GET' && req.method !== 'HEAD' && !req.headers['content-type']) {
    return next(new HttpError(415, 'Content-Type required'));
  }
  next();
});

const api = express.Router();
api.use(express.json({limit: '2mb'}));

api.get('/storyboards', async (_req, res) => {
  const files = await fs.readdir(STORYBOARD_DIR).catch(() => [] as string[]);
  res.json({names: files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort()});
});

api.get('/storyboards/:name', async (req, res) => {
  const raw = await fs.readFile(storyboardPath(req.params.name), 'utf8').catch(() => null);
  if (raw === null) throw new HttpError(404, `No storyboard named "${req.params.name}".`);
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new HttpError(400, `The file is not valid JSON: ${(err as Error).message}`);
  }
  const result = validateStoryboard(json);
  if (!result.ok) throw new HttpError(400, 'The file is not a valid storyboard.', result.errors);
  res.json({name: slugify(req.params.name), storyboard: await pruneMissingAudio(result.storyboard)});
});

api.put('/storyboards/:name', async (req, res) => {
  const storyboard = requireStoryboard(req.body?.storyboard);
  await fs.mkdir(STORYBOARD_DIR, {recursive: true});
  await fs.writeFile(storyboardPath(req.params.name), JSON.stringify(storyboard, null, 2) + '\n');
  res.json({name: slugify(req.params.name)});
});

api.get('/images', async (_req, res) => {
  res.json({images: await listImages()});
});

api.post(
  '/upload',
  express.raw({type: Object.keys(UPLOAD_TYPES), limit: '30mb'}),
  async (req, res) => {
    const ext = UPLOAD_TYPES[String(req.headers['content-type']).split(';')[0]];
    if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new HttpError(400, 'Upload a PNG, JPEG, WebP or GIF image.');
    }
    const base = slugify(path.parse(String(req.query.name ?? 'image')).name);
    const dir = path.join(PUBLIC_DIR, 'images');
    await fs.mkdir(dir, {recursive: true});
    // Never replace an existing image: other storyboards may use it, and the
    // browser would keep showing the cached old one.
    let file = base + ext;
    for (let n = 2; await fs.stat(path.join(dir, file)).then(() => true, () => false); n++) {
      file = `${base}-${n}${ext}`;
    }
    await fs.writeFile(path.join(dir, file), req.body, {flag: 'wx'});
    res.json({src: `images/${file}`});
  },
);

api.get('/voices', async (_req, res) => {
  const voices = await listVoices().catch(() => []);
  res.json({voices: voices.filter((v) => v.locale.startsWith('en')).map((v) => v.name)});
});

api.post('/voiceover', async (req, res) => {
  const storyboard = requireStoryboard(req.body?.storyboard);
  const name = String(req.body?.name ?? storyboard.title);
  res.json({storyboard: await serialized(() => synthesizeVoiceover(storyboard, name))});
});

api.get('/models', async (_req, res) => {
  try {
    res.json({models: await listModels(), default: DEFAULT_MODEL});
  } catch (err) {
    res.json({models: [], default: DEFAULT_MODEL, error: (err as Error).message});
  }
});

api.post('/generate', async (req, res) => {
  const {concept, model, theme, seconds} = req.body ?? {};
  if (typeof concept !== 'string' || !concept.trim()) throw new HttpError(400, 'Type a concept first.');
  try {
    const result = await generateStoryboard({
      concept: concept.slice(0, 4000),
      model: typeof model === 'string' ? model : undefined,
      theme: THEME_IDS.includes(theme) ? (theme as ThemeId) : undefined,
      seconds: typeof seconds === 'number' ? seconds : undefined,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof OllamaError) throw new HttpError(502, err.message);
    throw err;
  }
});

api.post('/render', (req, res) => {
  const aspect = req.body?.aspect as Aspect;
  if (typeof aspect !== 'string' || !Object.hasOwn(ASPECTS, aspect)) throw new HttpError(400, 'aspect must be "16:9" or "9:16".');
  requireStoryboard(req.body?.storyboard);
  const name = String(req.body?.name || 'untitled');
  res.json(enqueueRender(req.body.storyboard, name, aspect));
});

api.get('/render/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) throw new HttpError(404, 'Unknown render job.');
  res.json(job);
});

api.use((_req, _res, next) => next(new HttpError(404, 'Not found')));

app.use('/api', api);
app.use('/out', express.static(OUT_DIR));
// Serve public/ ourselves: Vite only knows the files that existed when it
// started, so freshly generated voiceover and uploads would 404 into the SPA.
app.use(express.static(PUBLIC_DIR, {index: false}));

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith('/api') && !(err instanceof HttpError)) return next(err);
  const status = err instanceof HttpError ? err.status : ((err as {status?: number}).status ?? 500);
  if (status >= 500) console.error(err);
  res.status(status).json({error: err.message, errors: err instanceof HttpError ? err.errors : undefined});
});

// The Studio UI is served by Vite in middleware mode: one process, one port.
const vite = await createViteServer({
  root: ROOT,
  server: {middlewareMode: true},
  appType: 'spa',
});
app.use(vite.middlewares);

app.listen(PORT, HOST, () => {
  console.log(`\n  Video Studio → http://localhost:${PORT}\n`);
});
