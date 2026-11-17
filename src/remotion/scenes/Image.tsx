import React from 'react';
import {Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import type {SceneOf} from '../../shared/schema';
import {SceneFrame, riseIn, useEnter, useLayout, useTheme} from '../components/layout';

export const resolveAsset = (src: string) =>
  /^https?:\/\//.test(src) ? src : staticFile(src);

const PAN = 7; // percent of travel across the scene

export const ImageScene: React.FC<{scene: SceneOf<'image'>}> = ({scene}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const {u, portrait, width, height, pad, safeBottom, durationInFrames} = useLayout();
  const enter = useEnter(2, 20);
  const caption = useEnter(18);
  const t = interpolate(frame, [0, durationInFrames], [0, 1], {extrapolateRight: 'clamp'});
  const pan = scene.pan ?? 'zoom-in';

  // Slow, linear camera move. The image is oversized so edges never show.
  let scale = 1.2;
  let x = 0;
  let y = 0;
  if (pan === 'zoom-in') scale = 1.04 + t * 0.2;
  if (pan === 'zoom-out') scale = 1.24 - t * 0.2;
  if (pan === 'left') x = PAN - t * PAN * 2;
  if (pan === 'right') x = -PAN + t * PAN * 2;
  if (pan === 'up') y = PAN - t * PAN * 2;
  if (pan === 'down') y = -PAN + t * PAN * 2;

  const frameWidth = width - pad * 2;
  const captionSpace = scene.caption ? 120 * u : 0;
  const frameHeight = Math.min(
    height - pad * 2 - safeBottom - captionSpace,
    portrait ? frameWidth * 1.1 : frameWidth * 0.5,
  );
  const border = theme.scrapbook ? 22 * u : 0;

  return (
    <SceneFrame>
      <div
        style={{
          position: 'relative',
          width: frameWidth,
          height: frameHeight,
          padding: border,
          boxSizing: 'border-box',
          background: theme.scrapbook ? '#fff' : 'transparent',
          borderRadius: theme.radius * u,
          boxShadow: `0 ${24 * u}px ${70 * u}px rgba(0,0,0,0.28)`,
          opacity: Math.min(1, enter * 1.5),
          transform: `scale(${0.94 + enter * 0.06}) rotate(${theme.scrapbook ? -1.2 : 0}deg)`,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            borderRadius: Math.max(0, theme.radius * u - border),
            border: theme.scrapbook ? 'none' : `${2 * u}px solid ${theme.colors.panelBorder}`,
            boxSizing: 'border-box',
          }}
        >
          <Img
            src={resolveAsset(scene.src)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${scale}) translate(${x}%, ${y}%)`,
            }}
          />
        </div>
        {theme.scrapbook ? (
          <div
            style={{
              position: 'absolute',
              top: -24 * u,
              left: '50%',
              width: 210 * u,
              height: 52 * u,
              marginLeft: -105 * u,
              background: 'rgba(255, 209, 102, 0.82)',
              transform: 'rotate(2.5deg)',
              boxShadow: `0 ${2 * u}px ${6 * u}px rgba(0,0,0,0.15)`,
            }}
          />
        ) : null}
      </div>
      {scene.caption ? (
        <div
          style={{
            marginTop: 44 * u,
            fontSize: 50 * u * theme.bodyScale,
            lineHeight: 1.25,
            maxWidth: frameWidth,
            textWrap: 'balance',
            ...riseIn(caption, 20 * u),
          }}
        >
          {scene.caption}
        </div>
      ) : null}
    </SceneFrame>
  );
};
