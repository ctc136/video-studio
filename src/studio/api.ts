import type {Aspect, Storyboard, ThemeId} from '../shared/schema';

export class ApiError extends Error {
  constructor(
    message: string,
    public errors: string[] = [],
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError('Cannot reach the Studio server. Is "npm run studio" still running?');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, body.errors ?? []);
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify(body),
});

export type RenderJob = {
  id: string;
  aspect: Aspect;
  status: 'queued' | 'voiceover' | 'bundling' | 'rendering' | 'done' | 'error';
  progress: number;
  file?: string;
  url?: string;
  error?: string;
};

export type GenerateAttempt = {attempt: number; ok: boolean; errors: string[]};

export const api = {
  listStoryboards: () => request<{names: string[]}>('/api/storyboards'),
  loadStoryboard: (name: string) =>
    request<{name: string; storyboard: Storyboard}>(`/api/storyboards/${encodeURIComponent(name)}`),
  saveStoryboard: (name: string, storyboard: Storyboard) =>
    request<{name: string}>(`/api/storyboards/${encodeURIComponent(name)}`, json('PUT', {storyboard})),
  listImages: () => request<{images: string[]}>('/api/images'),
  uploadImage: (file: File) =>
    request<{src: string}>(`/api/upload?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: {'Content-Type': file.type},
      body: file,
    }),
  listVoices: () => request<{voices: string[]}>('/api/voices'),
  voiceover: (name: string, storyboard: Storyboard) =>
    request<{storyboard: Storyboard}>('/api/voiceover', json('POST', {name, storyboard})),
  listModels: () => request<{models: string[]; default: string; error?: string}>('/api/models'),
  generate: (body: {concept: string; model?: string; theme?: ThemeId; seconds?: number}) =>
    request<{storyboard: Storyboard; attempts: GenerateAttempt[]; model: string}>(
      '/api/generate',
      json('POST', body),
    ),
  startRender: (name: string, storyboard: Storyboard, aspect: Aspect) =>
    request<RenderJob>('/api/render', json('POST', {name, storyboard, aspect})),
  renderStatus: (id: string) => request<RenderJob>(`/api/render/${id}`),
};
