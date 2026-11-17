import React from 'react';
import {spring, useCurrentFrame} from 'remotion';
import type {SceneOf} from '../../shared/schema';
import {
  Heading,
  SceneFrame,
  Underline,
  riseIn,
  useEnter,
  useLayout,
  useTheme,
} from '../components/layout';

export const BulletsScene: React.FC<{scene: SceneOf<'bullets'>}> = ({scene}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const {u, fps, portrait, durationInFrames, pad} = useLayout();
  const head = useEnter(6);
  const n = scene.items.length;
  const first = scene.heading ? 26 : 10;
  // Reveal the list across the first ~60% so the last item still gets read.
  const step = Math.max(8, Math.min(34, (durationInFrames * 0.6 - first) / n));
  const dense = n > 4;
  const itemSize = (dense ? 46 : 56) * u * theme.bodyScale * (portrait ? 0.95 : 1);
  const marker = itemSize * 0.95;

  return (
    <SceneFrame align="start" style={{paddingLeft: pad * (portrait ? 1.5 : 1.6)}}>
      {scene.heading ? (
        <div style={{marginBottom: 50 * u, ...riseIn(head, 30 * u)}}>
          <Heading size={(portrait ? 84 : 96) * u}>{scene.heading}</Heading>
          <div style={{marginTop: 14 * u, height: 26 * u}}>
            <Underline progress={enterAt(frame, fps, 16)} width={300 * u} />
          </div>
        </div>
      ) : null}
      <div style={{display: 'flex', flexDirection: 'column', gap: (dense ? 26 : 38) * u}}>
        {scene.items.map((item, i) => {
          const at = first + i * step;
          const p = spring({frame: frame - at, fps, config: {damping: 200}});
          const pop = spring({frame: frame - at, fps, config: {damping: 11, mass: 0.5}});
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 28 * u,
                opacity: Math.min(1, p * 1.6),
                transform: `translateX(${(1 - p) * 60 * u}px)`,
              }}
            >
              <div
                style={{
                  flex: 'none',
                  width: marker,
                  height: marker,
                  marginTop: itemSize * 0.14,
                  borderRadius: theme.scrapbook ? 4 * u : marker,
                  border: theme.scrapbook ? `${4 * u}px solid ${theme.colors.ink}` : 'none',
                  background: theme.scrapbook ? 'transparent' : theme.colors.accent,
                  color: theme.scrapbook ? theme.colors.accent : theme.colors.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.fonts.heading,
                  fontWeight: 700,
                  fontSize: theme.scrapbook ? marker * 1.5 : marker * 0.56,
                  lineHeight: 1,
                  boxSizing: 'border-box',
                  transform: `scale(${pop})`,
                }}
              >
                {theme.scrapbook ? (
                  <span style={{transform: `translate(8%, -14%)`}}>✓</span>
                ) : (
                  i + 1
                )}
              </div>
              <div style={{fontSize: itemSize, lineHeight: 1.28, maxWidth: 1350 * u}}>{item}</div>
            </div>
          );
        })}
      </div>
    </SceneFrame>
  );
};

const enterAt = (frame: number, fps: number, delay: number) =>
  spring({frame: frame - delay, fps, config: {damping: 200}});
