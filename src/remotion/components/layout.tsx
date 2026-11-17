import React, {createContext, useContext} from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Theme} from '../themes';
import {themes} from '../themes';
import {Background} from './Background';

type SceneEnv = {theme: Theme; captions: boolean; durationInFrames: number};

const SceneContext = createContext<SceneEnv>({
  theme: themes.notebook,
  captions: false,
  durationInFrames: 1,
});
export const SceneProvider = SceneContext.Provider;
export const useTheme = () => useContext(SceneContext).theme;

/**
 * Everything is sized in `u` units (1u = 1px on a 1080-tall landscape frame)
 * so the same template works in 16:9 and 9:16.
 */
export function useLayout() {
  const {width, height, fps} = useVideoConfig();
  // The scene's own length, not the whole video's.
  const {captions, durationInFrames} = useContext(SceneContext);
  const portrait = height > width;
  const u = Math.min(width, height) / 1080;
  const pad = (portrait ? 84 : 130) * u;
  // Keep the bottom strip free when captions are burned in.
  const safeBottom = captions ? (portrait ? 330 : 170) * u : 0;
  return {width, height, fps, durationInFrames, portrait, u, pad, safeBottom};
}

/** 0 → 1 with a soft landing. The workhorse entrance curve. */
export function useEnter(delay = 0, damping = 200) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - delay, fps, config: {damping}});
}

export const riseIn = (progress: number, distance: number): React.CSSProperties => ({
  opacity: Math.min(1, progress * 1.4),
  transform: `translateY(${(1 - progress) * distance}px)`,
});

export const SceneFrame: React.FC<{
  children: React.ReactNode;
  align?: 'center' | 'start';
  style?: React.CSSProperties;
}> = ({children, align = 'center', style}) => {
  const theme = useTheme();
  const {pad, safeBottom} = useLayout();
  return (
    <AbsoluteFill style={{backgroundColor: theme.colors.bg}}>
      <Background />
      <AbsoluteFill
        style={{
          padding: pad,
          paddingBottom: pad + safeBottom,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: align === 'center' ? 'center' : 'flex-start',
          textAlign: align === 'center' ? 'center' : 'left',
          color: theme.colors.ink,
          fontFamily: theme.fonts.body,
          fontWeight: theme.bodyWeight,
          ...style,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Heading: React.FC<{
  children: React.ReactNode;
  size: number;
  style?: React.CSSProperties;
}> = ({children, size, style}) => {
  const theme = useTheme();
  return (
    <div
      style={{
        fontFamily: theme.fonts.heading,
        fontWeight: theme.headingWeight,
        fontSize: size * theme.headingScale,
        letterSpacing: theme.headingLetterSpacing,
        lineHeight: 1.04,
        textWrap: 'balance',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Split "some *loud* words" into words flagged for emphasis. */
export function parseEmphasis(text: string): {word: string; em: boolean}[] {
  const out: {word: string; em: boolean}[] = [];
  let em = false;
  for (const part of text.split('*')) {
    for (const word of part.split(/\s+/).filter(Boolean)) out.push({word, em});
    em = !em;
  }
  return out;
}

/** One emphasised word, styled per theme. `progress` animates the highlight. */
export const Emphasis: React.FC<{children: React.ReactNode; progress?: number}> = ({
  children,
  progress = 1,
}) => {
  const theme = useTheme();
  if (theme.emphasis === 'highlighter') {
    return (
      <span
        style={{
          backgroundImage: `linear-gradient(${theme.colors.terminalPrompt}, ${theme.colors.terminalPrompt})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${progress * 100}% 46%`,
          backgroundPosition: '0 82%',
          padding: '0 0.12em',
          margin: '0 -0.12em',
        }}
      >
        {children}
      </span>
    );
  }
  return <span style={{color: theme.colors.accent}}>{children}</span>;
};

/** Underline that draws itself: a pen squiggle on notebook, a bar elsewhere. */
export const Underline: React.FC<{progress: number; width: number}> = ({progress, width}) => {
  const theme = useTheme();
  const {u} = useLayout();
  if (theme.background === 'graph-paper') {
    // Drawn at its real size (no stretching) so the pen stroke stays even.
    const height = 26 * u;
    const sx = width / 400;
    const sy = height / 26;
    const pt = (x: number, y: number) => `${x * sx} ${y * sy}`;
    const d = `M${pt(4, 14)} C ${pt(50, 2)}, ${pt(90, 24)}, ${pt(140, 12)} S ${pt(230, 4)}, ${pt(280, 14)} S ${pt(360, 22)}, ${pt(396, 9)}`;
    return (
      <svg width={width} height={height} style={{display: 'block', overflow: 'visible'}}>
        <path
          d={d}
          fill="none"
          stroke={theme.colors.accent}
          strokeWidth={6 * u}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - progress}
          opacity={progress > 0.001 ? 1 : 0}
        />
      </svg>
    );
  }
  return (
    <div
      style={{
        width: width * progress,
        height: 10 * u,
        borderRadius: 10 * u,
        background: `linear-gradient(90deg, ${theme.colors.accent}, ${theme.colors.accent2})`,
      }}
    />
  );
};
