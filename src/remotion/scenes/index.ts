import type React from 'react';
import type {Scene, TemplateId} from '../../shared/schema';
import {BulletsScene} from './Bullets';
import {ChartScene} from './Chart';
import {ImageScene} from './Image';
import {KineticScene} from './Kinetic';
import {OutroScene} from './Outro';
import {StatScene} from './Stat';
import {TerminalScene} from './Terminal';
import {TitleScene} from './Title';

/**
 * Template registry. To add a template: add its schema in
 * src/shared/schema.ts, write the component, and register it here.
 */
export const sceneComponents: {
  [T in TemplateId]: React.FC<{scene: Extract<Scene, {template: T}>}>;
} = {
  title: TitleScene,
  kinetic: KineticScene,
  bullets: BulletsScene,
  stat: StatScene,
  chart: ChartScene,
  image: ImageScene,
  terminal: TerminalScene,
  outro: OutroScene,
};
