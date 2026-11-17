import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {CaptionCue} from '../../shared/timeline';
import type {Theme} from '../themes';

/** Burned-in captions. Sits above the scenes so transitions don't move it. */
export const Captions: React.FC<{cues: CaptionCue[]; theme: Theme}> = ({cues, theme}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const portrait = height > width;
  const u = Math.min(width, height) / 1080;
  const cue = cues.find((c) => frame >= c.from && frame < c.to);
  if (!cue) return null;
  const pop = interpolate(frame - cue.from, [0, 4], [0.94, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: (portrait ? 210 : 70) * u,
        paddingLeft: 60 * u,
        paddingRight: 60 * u,
      }}
    >
      <div
        style={{
          transform: `scale(${pop})`,
          background: theme.colors.captionBg,
          color: theme.colors.captionInk,
          fontFamily: theme.fonts.body,
          fontWeight: 600,
          fontSize: (portrait ? 54 : 46) * u * theme.bodyScale,
          lineHeight: 1.25,
          padding: `${14 * u}px ${34 * u}px`,
          borderRadius: 16 * u,
          textAlign: 'center',
          maxWidth: '92%',
        }}
      >
        {cue.text}
      </div>
    </AbsoluteFill>
  );
};
