import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import type {SceneOf} from '../../shared/schema';
import {
  Emphasis,
  Heading,
  SceneFrame,
  parseEmphasis,
  riseIn,
  useEnter,
  useLayout,
  useTheme,
} from '../components/layout';

export const OutroScene: React.FC<{scene: SceneOf<'outro'>}> = ({scene}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const {u, portrait, durationInFrames} = useLayout();
  const title = useEnter(6, 16);
  const mark = useEnter(20);
  const sub = useEnter(18);
  const cta = useEnter(32, 12);
  // A slow push-in keeps the card alive while it holds.
  const drift = interpolate(frame, [0, durationInFrames], [1, 1.04]);
  const size = (scene.title.length > 26 ? 110 : 140) * u * (portrait ? 0.9 : 1);

  return (
    <SceneFrame>
      <div style={{transform: `scale(${drift})`, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <Heading
          size={size}
          style={{opacity: Math.min(1, title * 1.5), transform: `scale(${0.85 + title * 0.15})`}}
        >
          {parseEmphasis(scene.title).map(({word, em}, i) => (
            <span key={i} style={{display: 'inline-block', marginRight: '0.24em'}}>
              {em ? <Emphasis progress={mark}>{word}</Emphasis> : word}
            </span>
          ))}
        </Heading>
        {scene.subtitle ? (
          <div
            style={{
              marginTop: 30 * u,
              fontSize: 48 * u * theme.bodyScale,
              color: theme.colors.muted,
              maxWidth: 1200 * u,
              lineHeight: 1.3,
              textWrap: 'balance',
              ...riseIn(sub, 24 * u),
            }}
          >
            {scene.subtitle}
          </div>
        ) : null}
        {scene.cta ? (
          <div
            style={{
              marginTop: 60 * u,
              padding: `${22 * u}px ${52 * u}px`,
              fontSize: 44 * u * theme.bodyScale,
              fontWeight: 700,
              color: theme.scrapbook ? theme.colors.ink : theme.colors.bg,
              background: theme.scrapbook ? theme.colors.terminalPrompt : theme.colors.accent,
              border: theme.scrapbook ? `${4 * u}px solid ${theme.colors.ink}` : 'none',
              borderRadius: theme.scrapbook ? 10 * u : 999,
              boxShadow: theme.scrapbook
                ? `${8 * u}px ${8 * u}px 0 ${theme.colors.ink}`
                : `0 ${14 * u}px ${40 * u}px ${theme.colors.accent}55`,
              opacity: Math.min(1, cta * 1.5),
              transform: `scale(${0.8 + cta * 0.2}) rotate(${theme.scrapbook ? -1.5 : 0}deg)`,
            }}
          >
            {scene.cta}
          </div>
        ) : null}
      </div>
    </SceneFrame>
  );
};
