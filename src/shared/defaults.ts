import type {Scene, Storyboard, TemplateId} from './schema';

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  title: 'Title card',
  kinetic: 'Kinetic text',
  bullets: 'Bullet reveal',
  stat: 'Big stat',
  chart: 'Chart',
  image: 'Image pan',
  terminal: 'Terminal',
  outro: 'Outro card',
};

let counter = 0;
export const newSceneId = () => `scene-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** A sensible starting point for a new scene of each template. */
export function defaultScene(template: TemplateId): Scene {
  const id = newSceneId();
  switch (template) {
    case 'title':
      return {id, template, duration: 3.5, title: 'A new *title*', subtitle: 'And a subtitle'};
    case 'kinetic':
      return {id, template, duration: 3.5, text: 'Say one *big* thing'};
    case 'bullets':
      return {id, template, duration: 5, heading: 'Three things', items: ['First', 'Second', 'Third']};
    case 'stat':
      return {id, template, duration: 3.5, value: 42, suffix: '%', label: 'of statistics are made up'};
    case 'chart':
      return {
        id,
        template,
        duration: 4.5,
        heading: 'Up and to the right',
        kind: 'bar',
        data: [
          {label: 'Q1', value: 2},
          {label: 'Q2', value: 4},
          {label: 'Q3', value: 7},
        ],
      };
    case 'image':
      return {id, template, duration: 4, src: 'images/mountains.svg', caption: 'A caption', pan: 'zoom-in'};
    case 'terminal':
      return {id, template, duration: 4.5, title: 'zsh', lines: ['$ echo "hello"', 'hello']};
    case 'outro':
      return {id, template, duration: 3.5, title: 'Thanks for watching', cta: 'Follow along'};
  }
}

export function emptyStoryboard(): Storyboard {
  return {
    title: 'Untitled video',
    theme: 'notebook',
    transition: {type: 'fade', duration: 0.5},
    voiceover: {enabled: false, voice: 'Samantha', rate: 185},
    captions: false,
    scenes: [defaultScene('title'), defaultScene('outro')],
  };
}

/** One-line summary of a scene for lists. */
export function sceneSummary(scene: Scene): string {
  switch (scene.template) {
    case 'title':
    case 'outro':
      return scene.title;
    case 'kinetic':
      return scene.text;
    case 'bullets':
      return scene.heading ?? scene.items[0] ?? '';
    case 'stat':
      return `${scene.prefix ?? ''}${scene.value}${scene.suffix ?? ''} ${scene.label}`;
    case 'chart':
      return scene.heading ?? `${scene.kind} chart`;
    case 'image':
      return scene.caption ?? scene.src;
    case 'terminal':
      return scene.lines[0] ?? '';
  }
}
