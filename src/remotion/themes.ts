import {loadFont as loadCaveat} from '@remotion/google-fonts/Caveat';
import {loadFont as loadFraunces} from '@remotion/google-fonts/Fraunces';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';
import {loadFont as loadPatrickHand} from '@remotion/google-fonts/PatrickHand';
import {loadFont as loadSpaceGrotesk} from '@remotion/google-fonts/SpaceGrotesk';
import type {ThemeId} from '../shared/schema';

const latin = {subsets: ['latin' as const]};
const caveat = loadCaveat('normal', {weights: ['700'], ...latin}).fontFamily;
const patrickHand = loadPatrickHand('normal', {weights: ['400'], ...latin}).fontFamily;
const inter = loadInter('normal', {weights: ['400', '600', '800'], ...latin}).fontFamily;
const spaceGrotesk = loadSpaceGrotesk('normal', {weights: ['400', '700'], ...latin}).fontFamily;
const fraunces = loadFraunces('normal', {weights: ['600', '900'], ...latin}).fontFamily;
const mono = loadMono('normal', {weights: ['400', '700'], ...latin}).fontFamily;

export type Theme = {
  id: ThemeId;
  name: string;
  background: 'graph-paper' | 'glow' | 'sun';
  colors: {
    bg: string;
    ink: string;
    muted: string;
    accent: string;
    accent2: string;
    /** Cards, chart tracks, image frames. */
    panel: string;
    panelBorder: string;
    terminalBg: string;
    terminalInk: string;
    terminalPrompt: string;
    captionBg: string;
    captionInk: string;
  };
  fonts: {heading: string; body: string; mono: string};
  headingWeight: number;
  bodyWeight: number;
  /** Multiplier, because handwriting fonts run small. */
  headingScale: number;
  bodyScale: number;
  headingLetterSpacing: string;
  /** How *emphasised* words are drawn. */
  emphasis: 'highlighter' | 'color';
  radius: number;
  /** Photos get tape and a tilt. */
  scrapbook: boolean;
};

export const themes: Record<ThemeId, Theme> = {
  notebook: {
    id: 'notebook',
    name: 'Notebook',
    background: 'graph-paper',
    colors: {
      bg: '#fbf9f1',
      ink: '#1f2a44',
      muted: '#5b6785',
      accent: '#e4572e',
      accent2: '#2a6fdb',
      panel: '#ffffff',
      panelBorder: '#1f2a44',
      terminalBg: '#1f2a44',
      terminalInk: '#f3f1e7',
      terminalPrompt: '#ffd166',
      captionBg: 'rgba(31, 42, 68, 0.92)',
      captionInk: '#fffdf5',
    },
    fonts: {heading: caveat, body: patrickHand, mono},
    headingWeight: 700,
    bodyWeight: 400,
    headingScale: 1.28,
    bodyScale: 1.12,
    headingLetterSpacing: '0',
    emphasis: 'highlighter',
    radius: 6,
    scrapbook: true,
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    background: 'glow',
    colors: {
      bg: '#0a0e1f',
      ink: '#f4f6ff',
      muted: '#9aa4c7',
      accent: '#7cf5c4',
      accent2: '#8b7bff',
      panel: 'rgba(255, 255, 255, 0.06)',
      panelBorder: 'rgba(255, 255, 255, 0.16)',
      terminalBg: '#05070f',
      terminalInk: '#dfe6ff',
      terminalPrompt: '#7cf5c4',
      captionBg: 'rgba(5, 7, 15, 0.86)',
      captionInk: '#ffffff',
    },
    fonts: {heading: spaceGrotesk, body: spaceGrotesk, mono},
    headingWeight: 700,
    bodyWeight: 400,
    headingScale: 1,
    bodyScale: 1,
    headingLetterSpacing: '-0.03em',
    emphasis: 'color',
    radius: 22,
    scrapbook: false,
  },
  sunrise: {
    id: 'sunrise',
    name: 'Sunrise',
    background: 'sun',
    colors: {
      bg: '#ffe9d2',
      ink: '#3a1730',
      muted: '#7d4a5f',
      accent: '#e8384f',
      accent2: '#f08a24',
      panel: 'rgba(255, 255, 255, 0.62)',
      panelBorder: 'rgba(58, 23, 48, 0.14)',
      terminalBg: '#3a1730',
      terminalInk: '#ffeede',
      terminalPrompt: '#ffb454',
      captionBg: 'rgba(58, 23, 48, 0.9)',
      captionInk: '#fff6ec',
    },
    fonts: {heading: fraunces, body: inter, mono},
    headingWeight: 900,
    bodyWeight: 400,
    headingScale: 1,
    bodyScale: 1,
    headingLetterSpacing: '-0.02em',
    emphasis: 'color',
    radius: 28,
    scrapbook: false,
  },
};

export const getTheme = (id: ThemeId): Theme => themes[id] ?? themes.notebook;
