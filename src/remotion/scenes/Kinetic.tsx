import React from 'react';
import {spring, useCurrentFrame} from 'remotion';
import type {SceneOf} from '../../shared/schema';
import {
  Emphasis,
  Heading,
  SceneFrame,
  parseEmphasis,
  useLayout,
} from '../components/layout';

export const KineticScene: React.FC<{scene: SceneOf<'kinetic'>}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {u, fps, portrait, durationInFrames} = useLayout();
  const words = parseEmphasis(scene.text);
  const n = words.length;

  // Words land one at a time and are all in by ~65% of the scene.
  const start = 10;
  const step = Math.max(2, Math.min(9, (durationInFrames * 0.65 - start) / n));
  const base = n <= 4 ? 190 : n <= 8 ? 150 : n <= 14 ? 116 : 90;
  const size = base * u * (portrait ? 0.82 : 1);

  return (
    <SceneFrame>
      <Heading size={size} style={{lineHeight: 1.12, maxWidth: 1650 * u}}>
        {words.map(({word, em}, i) => {
          const at = start + i * step;
          const p = spring({frame: frame - at, fps, config: {damping: 12, mass: 0.6}});
          const mark = spring({frame: frame - at - 6, fps, config: {damping: 200}});
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: '0.26em',
                opacity: frame >= at ? 1 : 0,
                transform: `scale(${0.4 + p * 0.6}) translateY(${(1 - p) * 40 * u}px)`,
                transformOrigin: '50% 80%',
              }}
            >
              {em ? <Emphasis progress={mark}>{word}</Emphasis> : word}
            </span>
          );
        })}
      </Heading>
    </SceneFrame>
  );
};
