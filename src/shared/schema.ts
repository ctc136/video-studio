import {z} from 'zod';

/** Every video renders at this frame rate. */
export const FPS = 30;

export const THEME_IDS = ['notebook', 'midnight', 'sunrise'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const TRANSITION_TYPES = ['fade', 'slide', 'wipe', 'none'] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];

export const ASPECTS = {
  '16:9': {width: 1920, height: 1080},
  '9:16': {width: 1080, height: 1920},
} as const;
export type Aspect = keyof typeof ASPECTS;

export const TEMPLATE_IDS = [
  'title',
  'kinetic',
  'bullets',
  'stat',
  'chart',
  'image',
  'terminal',
  'outro',
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1, 'must not be empty')
    .max(max, `must be at most ${max} characters`);

const assetPath = z
  .string()
  .trim()
  .min(1, 'must not be empty')
  .refine(
    (s) =>
      /^https?:\/\//.test(s) ||
      (!s.startsWith('/') && !s.split(/[\\/]/).includes('..')),
    'must be an http(s) URL or a path relative to the public/ folder (e.g. "images/desk.svg")',
  );

const audioSchema = z.object({
  /** Path relative to public/. Written by the voiceover step. */
  src: assetPath,
  /** Length of the audio in seconds. */
  duration: z.number().positive(),
  /** Hash of the narration + voice settings this audio was made from. */
  key: z.string(),
});

const base = {
  id: z.string().min(1).optional(),
  /** Seconds on screen. Stretched automatically if the voiceover is longer. */
  duration: z
    .number({error: 'must be a number of seconds'})
    .min(1, 'must be at least 1 second')
    .max(30, 'must be at most 30 seconds'),
  /** Spoken by the voiceover and shown as captions. */
  narration: z.string().trim().max(600).optional(),
  audio: audioSchema.optional(),
};

export const sceneSchemas = {
  title: z.object({
    template: z.literal('title'),
    ...base,
    title: text(80),
    subtitle: text(140).optional(),
  }),
  kinetic: z.object({
    template: z.literal('kinetic'),
    ...base,
    /** Wrap words in *asterisks* to emphasise them. */
    text: text(160),
  }),
  bullets: z.object({
    template: z.literal('bullets'),
    ...base,
    heading: text(80).optional(),
    items: z
      .array(text(110))
      .min(1, 'needs at least 1 item')
      .max(6, 'can have at most 6 items'),
  }),
  stat: z.object({
    template: z.literal('stat'),
    ...base,
    value: z.number({error: 'must be a number (put units in prefix/suffix)'}),
    prefix: z.string().max(6).optional(),
    suffix: z.string().max(12).optional(),
    decimals: z.number().int().min(0).max(3).optional(),
    label: text(100),
  }),
  chart: z.object({
    template: z.literal('chart'),
    ...base,
    heading: text(80).optional(),
    kind: z.enum(['bar', 'line'], {error: 'must be "bar" or "line"'}),
    unit: z.string().max(8).optional(),
    data: z
      .array(
        z.object({
          label: text(18),
          value: z.number().min(0, 'must be zero or more'),
        }),
      )
      .min(2, 'needs at least 2 data points')
      .max(8, 'can have at most 8 data points'),
  }),
  image: z.object({
    template: z.literal('image'),
    ...base,
    src: assetPath,
    caption: text(120).optional(),
    pan: z
      .enum(['left', 'right', 'up', 'down', 'zoom-in', 'zoom-out'], {
        error: 'must be one of left, right, up, down, zoom-in, zoom-out',
      })
      .optional(),
  }),
  terminal: z.object({
    template: z.literal('terminal'),
    ...base,
    title: z.string().max(40).optional(),
    /** Lines starting with "$ " are typed out; the rest appear as output. */
    lines: z
      .array(z.string().max(90, 'must be at most 90 characters'))
      .min(1, 'needs at least 1 line')
      .max(10, 'can have at most 10 lines'),
  }),
  outro: z.object({
    template: z.literal('outro'),
    ...base,
    title: text(80),
    subtitle: text(140).optional(),
    cta: text(50).optional(),
  }),
} satisfies Record<TemplateId, z.ZodType>;

export const sceneSchema = z.discriminatedUnion('template', [
  sceneSchemas.title,
  sceneSchemas.kinetic,
  sceneSchemas.bullets,
  sceneSchemas.stat,
  sceneSchemas.chart,
  sceneSchemas.image,
  sceneSchemas.terminal,
  sceneSchemas.outro,
]);

export const storyboardSchema = z.object({
  title: text(100),
  theme: z.enum(THEME_IDS, {
    error: `must be one of: ${THEME_IDS.join(', ')}`,
  }),
  transition: z
    .object({
      type: z.enum(TRANSITION_TYPES, {
        error: `must be one of: ${TRANSITION_TYPES.join(', ')}`,
      }),
      /** Seconds. */
      duration: z.number().min(0.1).max(2).default(0.5),
    })
    .default({type: 'fade', duration: 0.5}),
  voiceover: z
    .object({
      enabled: z.boolean().default(false),
      /** A macOS voice name, see `say -v '?'`. */
      voice: z.string().max(60).default('Samantha'),
      /** Words per minute. */
      rate: z.number().min(90).max(360).default(185),
    })
    .default({enabled: false, voice: 'Samantha', rate: 185}),
  captions: z.boolean().default(false),
  scenes: z
    .array(sceneSchema)
    .min(1, 'needs at least 1 scene')
    .max(40, 'can have at most 40 scenes'),
});

export type Scene = z.infer<typeof sceneSchema>;
export type SceneOf<T extends TemplateId> = Extract<Scene, {template: T}>;
export type Storyboard = z.infer<typeof storyboardSchema>;
export type SceneAudio = z.infer<typeof audioSchema>;

export type ValidationResult =
  | {ok: true; storyboard: Storyboard}
  | {ok: false; errors: string[]};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const formatPath = (path: PropertyKey[]) =>
  path
    .map((p, i) =>
      typeof p === 'number' ? `[${p}]` : i === 0 ? String(p) : `.${String(p)}`,
    )
    .join('');

/**
 * Validate anything (parsed JSON) as a storyboard. Errors are written for
 * humans and for LLM retry loops: one line each, with the path and the fix.
 */
export function validateStoryboard(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: ['storyboard: must be a JSON object with "title", "theme" and "scenes"'],
    };
  }

  const result = storyboardSchema.safeParse(input);
  if (result.success) {
    const seen = new Set<string>();
    const scenes = result.data.scenes.map((scene, i) => {
      let id = scene.id && !seen.has(scene.id) ? scene.id : `scene-${i + 1}`;
      while (seen.has(id)) id = `${id}-x`;
      seen.add(id);
      return {...scene, id};
    });
    return {ok: true, storyboard: {...result.data, scenes}};
  }

  const rawScenes = Array.isArray(input.scenes) ? input.scenes : [];
  const errors = result.error.issues.map((issue) => {
    const path = formatPath(issue.path);
    const sceneIndex = issue.path[0] === 'scenes' ? issue.path[1] : undefined;
    const raw = typeof sceneIndex === 'number' ? rawScenes[sceneIndex] : undefined;
    const template = isRecord(raw) ? raw.template : undefined;

    // Unknown or missing template: zod reports this as a bare union error.
    if (
      typeof sceneIndex === 'number' &&
      !(TEMPLATE_IDS as readonly unknown[]).includes(template)
    ) {
      const got = template === undefined ? 'missing' : JSON.stringify(template);
      return `scenes[${sceneIndex}].template: ${got} is not a template. Use one of: ${TEMPLATE_IDS.join(', ')}`;
    }

    const where =
      typeof template === 'string' && issue.path.length > 2
        ? `${path} (${template} scene)`
        : path || 'storyboard';
    let message = issue.message;
    if (issue.code === 'invalid_type' && /received undefined/.test(message)) {
      message = 'is required';
    }
    return `${where}: ${message}`;
  });

  return {ok: false, errors: [...new Set(errors)]};
}

/** Validate and throw a readable error. For scripts and trusted input. */
export function parseStoryboard(input: unknown): Storyboard {
  const result = validateStoryboard(input);
  if (!result.ok) {
    throw new Error(`Invalid storyboard:\n  - ${result.errors.join('\n  - ')}`);
  }
  return result.storyboard;
}

/** Stable key so we can tell when audio no longer matches the narration. */
export function audioKey(narration: string, voice: string, rate: number): string {
  const input = `${voice}|${rate}|${narration.trim()}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'untitled'
  );
}
