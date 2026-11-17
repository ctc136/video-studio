import {FPS, audioKey, type Scene, type Storyboard} from './schema';

export type SceneTiming = {
  index: number;
  /** First frame of the scene on the global timeline (transition included). */
  from: number;
  durationInFrames: number;
  /** Present when this scene has usable voiceover audio. */
  audio?: {src: string; from: number; durationInFrames: number};
};

export type CaptionCue = {text: string; from: number; to: number};

export type Timeline = {
  scenes: SceneTiming[];
  transitionFrames: number;
  totalFrames: number;
  captions: CaptionCue[];
};

/** Frames of silence before the first line and after every line. */
const LEAD_IN = 8;
const GAP = 8;
const CAPTION_MAX_CHARS = 32;
const MIN_CAPTION = 15;

/** Audio counts only if voiceover is on and it matches the current narration. */
export function activeAudio(storyboard: Storyboard, scene: Scene) {
  const {voiceover} = storyboard;
  if (!voiceover.enabled || !scene.audio || !scene.narration) return undefined;
  const key = audioKey(scene.narration, voiceover.voice, voiceover.rate);
  return scene.audio.key === key ? scene.audio : undefined;
}

/** True if any narrated scene still needs its audio (re)generated. */
export function needsVoiceover(storyboard: Storyboard): boolean {
  if (!storyboard.voiceover.enabled) return false;
  return storyboard.scenes.some(
    (scene) => scene.narration && !activeAudio(storyboard, scene),
  );
}

/** Break narration into short caption lines, splitting at punctuation first. */
export function splitCaption(text: string, maxChars = CAPTION_MAX_CHARS): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxChars) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
    if (/[.!?;:]$/.test(word) && current.length > maxChars * 0.4) {
      chunks.push(current);
      current = '';
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function buildTimeline(storyboard: Storyboard): Timeline {
  const {scenes, transition} = storyboard;
  const baseFrames = scenes.map((s) => Math.max(1, Math.round(s.duration * FPS)));

  // A transition may never be longer than half of the shortest scene.
  const requested = transition.type === 'none' ? 0 : Math.round(transition.duration * FPS);
  const transitionFrames = Math.max(
    0,
    Math.min(requested, Math.floor(Math.min(...baseFrames) / 2)),
  );

  const timings: SceneTiming[] = [];
  const captions: CaptionCue[] = [];
  let cursor = 0;

  scenes.forEach((scene, index) => {
    const audio = activeAudio(storyboard, scene);
    // Speech starts once the incoming transition has finished.
    const lead = index === 0 ? LEAD_IN : transitionFrames + 2;
    let durationInFrames = baseFrames[index];
    let audioTiming: SceneTiming['audio'];

    if (audio) {
      const audioFrames = Math.ceil(audio.duration * FPS);
      // The next scene's speech starts at `from + durationInFrames + 2`, so
      // fitting the audio inside the scene guarantees lines never overlap.
      durationInFrames = Math.max(durationInFrames, lead + audioFrames + GAP);
      audioTiming = {src: audio.src, from: cursor + lead, durationInFrames: audioFrames};
    }

    if (storyboard.captions && scene.narration) {
      const start = audioTiming ? audioTiming.from : cursor + lead;
      const end = audioTiming
        ? audioTiming.from + audioTiming.durationInFrames
        : Math.min(
            cursor + durationInFrames,
            Math.max(
              start + MIN_CAPTION,
              cursor + durationInFrames - (index === scenes.length - 1 ? GAP : transitionFrames),
            ),
          );
      const chunks = splitCaption(scene.narration);
      const totalChars = chunks.reduce((n, c) => n + c.length, 0);
      let t = start;
      chunks.forEach((chunk, i) => {
        const span = ((end - start) * chunk.length) / totalChars;
        const to = i === chunks.length - 1 ? end : Math.round(t + span);
        if (to > t) captions.push({text: chunk, from: Math.round(t), to});
        t += span;
      });
    }

    timings.push({index, from: cursor, durationInFrames, audio: audioTiming});
    cursor += durationInFrames - transitionFrames;
  });

  return {
    scenes: timings,
    transitionFrames,
    totalFrames: cursor + transitionFrames,
    captions,
  };
}

export function totalSeconds(storyboard: Storyboard): number {
  return buildTimeline(storyboard).totalFrames / FPS;
}
