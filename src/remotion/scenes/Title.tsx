import React from 'react';
import {spring, useCurrentFrame} from 'remotion';
import type {SceneOf} from '../../shared/schema';
import {
  Emphasis,
  Heading,
  SceneFrame,
  Underline,
  parseEmphasis,
  riseIn,
  useEnter,
  useLayout,
  useTheme,
} from '../components/layout';

export const TitleScene: React.FC<{scene: SceneOf<'title'>}> = ({scene}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const {u, fps, portrait, width, pad} = useLayout();
  const words = parseEmphasis(scene.title);
  const afterWords = 10 + words.length * 4;
  const line = useEnter(afterWords + 4);
  const sub = useEnter(afterWords + 14);
  const size = (scene.title.length > 28 ? 118 : 150) * u * (portrait ? 0.9 : 1);

  return (
    <SceneFrame>
      <Heading size={size}>
        {words.map(({word, em}, i) => {
          const p = spring({frame: frame - 8 - i * 4, fps, config: {damping: 16, mass: 0.7}});
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: '0.24em',
                opacity: Math.min(1, p * 1.5),
                transform: `translateY(${(1 - p) * 60 * u}px) rotate(${(1 - p) * -4}deg)`,
              }}
            >
              {em ? <Emphasis progress={line}>{word}</Emphasis> : word}
            </span>
          );
        })}
      </Heading>
      <div style={{marginTop: 26 * u, height: 26 * u}}>
        <Underline progress={line} width={Math.min(520 * u, width - pad * 2)} />
      </div>
      {scene.subtitle ? (
        <div
          style={{
            marginTop: 34 * u,
            fontSize: 50 * u * theme.bodyScale,
            color: theme.colors.muted,
            maxWidth: 1300 * u,
            lineHeight: 1.3,
            textWrap: 'balance',
            ...riseIn(sub, 24 * u),
          }}
        >
          {scene.subtitle}
        </div>
      ) : null}
    </SceneFrame>
  );
};
