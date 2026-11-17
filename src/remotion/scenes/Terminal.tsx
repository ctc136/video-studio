import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {SceneOf} from '../../shared/schema';
import {SceneFrame, useEnter, useLayout, useTheme} from '../components/layout';

const PROMPT = '$ ';
const PAUSE_AFTER_COMMAND = 9;
const OUTPUT_COST = 5;

/** Work out when each line starts and how fast commands are typed. */
export function scheduleLines(lines: string[], durationInFrames: number) {
  const isCommand = (line: string) => line.startsWith(PROMPT);
  const cost = lines.reduce(
    (sum, line) => sum + (isCommand(line) ? line.length - PROMPT.length + PAUSE_AFTER_COMMAND : OUTPUT_COST),
    0,
  );
  const start = 14;
  // Finish by ~80% of the scene (however fast that needs), never slower than 2 frames a key.
  const framesPerUnit = Math.min(2, Math.max(0.02, (durationInFrames * 0.8 - start) / cost));
  let cursor = start;
  return lines.map((line) => {
    const command = isCommand(line);
    const chars = command ? line.length - PROMPT.length : 0;
    const from = cursor;
    const typedBy = from + chars * framesPerUnit;
    cursor = command ? typedBy + PAUSE_AFTER_COMMAND * framesPerUnit : from + OUTPUT_COST * framesPerUnit;
    return {line, command, from, typedBy, framesPerUnit};
  });
}

export const TerminalScene: React.FC<{scene: SceneOf<'terminal'>}> = ({scene}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const {u, portrait, width, pad, durationInFrames} = useLayout();
  const enter = useEnter(0, 18);
  const schedule = scheduleLines(scene.lines, durationInFrames);

  const windowWidth = Math.min(width - pad * 2, 1500 * u);
  const longest = Math.max(...scene.lines.map((l) => l.length), 24);
  // Monospace glyphs are ~0.6em wide: pick the biggest size that fits.
  const fontSize = Math.min((portrait ? 40 : 42) * u, (windowWidth - 96 * u) / (longest * 0.61));
  const activeIndex = schedule.reduce((acc, s, i) => (frame >= s.from && s.command ? i : acc), -1);

  return (
    <SceneFrame>
      <div
        style={{
          width: windowWidth,
          background: theme.colors.terminalBg,
          borderRadius: Math.max(theme.radius, 14) * u,
          border: `${2 * u}px solid ${theme.colors.panelBorder}`,
          boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,0.35)`,
          overflow: 'hidden',
          textAlign: 'left',
          opacity: Math.min(1, enter * 1.5),
          transform: `translateY(${(1 - enter) * 50 * u}px) scale(${0.96 + enter * 0.04})`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12 * u,
            padding: `${20 * u}px ${26 * u}px`,
            background: 'rgba(255,255,255,0.07)',
          }}
        >
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <div key={c} style={{width: 20 * u, height: 20 * u, borderRadius: '50%', background: c}} />
          ))}
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              marginRight: 84 * u,
              fontFamily: theme.fonts.mono,
              fontSize: 24 * u,
              color: theme.colors.terminalInk,
              opacity: 0.6,
            }}
          >
            {scene.title ?? 'zsh'}
          </div>
        </div>
        <div
          style={{
            padding: `${34 * u}px ${48 * u}px ${44 * u}px`,
            fontFamily: theme.fonts.mono,
            fontSize,
            lineHeight: 1.6,
            color: theme.colors.terminalInk,
            minHeight: fontSize * 1.6 * Math.max(scene.lines.length, 4),
            whiteSpace: 'pre',
          }}
        >
          {schedule.map((s, i) => {
            if (frame < s.from) return null;
            if (!s.command) {
              return (
                <div key={i} style={{opacity: 0.82}}>
                  {s.line || ' '}
                </div>
              );
            }
            const body = s.line.slice(PROMPT.length);
            const typed = Math.min(body.length, Math.floor((frame - s.from) / s.framesPerUnit));
            const showCursor = i === activeIndex && (typed < body.length || Math.floor(frame / 15) % 2 === 0);
            return (
              <div key={i}>
                <span style={{color: theme.colors.terminalPrompt, fontWeight: 700}}>❯ </span>
                {body.slice(0, typed)}
                <span
                  style={{
                    display: 'inline-block',
                    width: fontSize * 0.58,
                    height: fontSize * 1.05,
                    marginLeft: 2 * u,
                    verticalAlign: 'text-bottom',
                    background: showCursor ? theme.colors.terminalPrompt : 'transparent',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </SceneFrame>
  );
};
