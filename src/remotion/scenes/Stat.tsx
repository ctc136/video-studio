import React from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
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

export const formatNumber = (value: number, decimals = 0) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const StatScene: React.FC<{scene: SceneOf<'stat'>}> = ({scene}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const {u, portrait, durationInFrames, width, pad} = useLayout();
  const decimals = scene.decimals ?? (Number.isInteger(scene.value) ? 0 : 1);

  const countEnd = Math.max(20, Math.min(75, durationInFrames * 0.5));
  const progress = interpolate(frame, [8, 8 + countEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const shown = formatNumber(scene.value * progress, decimals);
  const final = `${scene.prefix ?? ''}${formatNumber(scene.value, decimals)}${scene.suffix ?? ''}`;

  const pop = useEnter(4, 14);
  const line = useEnter(8 + countEnd - 6);
  const label = useEnter(8 + countEnd * 0.5);

  // Shrink long numbers so they always fit the frame width.
  const available = width - pad * 2;
  const natural = (portrait ? 300 : 360) * u;
  const size = Math.min(natural, (available / Math.max(3, final.length)) * 1.55);

  return (
    <SceneFrame>
      <Heading
        size={size / theme.headingScale}
        style={{
          color: theme.colors.accent,
          fontVariantNumeric: 'tabular-nums',
          transform: `scale(${0.7 + pop * 0.3})`,
          opacity: Math.min(1, pop * 2),
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}
      >
        {scene.prefix}
        {shown}
        {scene.suffix}
      </Heading>
      <div style={{marginTop: 18 * u, height: 26 * u}}>
        <Underline progress={line} width={Math.min(420 * u, available)} />
      </div>
      <div
        style={{
          marginTop: 36 * u,
          fontSize: 58 * u * theme.bodyScale,
          maxWidth: 1200 * u,
          lineHeight: 1.25,
          textWrap: 'balance',
          ...riseIn(label, 24 * u),
        }}
      >
        {scene.label}
      </div>
    </SceneFrame>
  );
};
