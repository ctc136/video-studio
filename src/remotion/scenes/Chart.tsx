import React from 'react';
import {Easing, interpolate, spring, useCurrentFrame} from 'remotion';
import type {SceneOf} from '../../shared/schema';
import {Heading, SceneFrame, riseIn, useEnter, useLayout, useTheme} from '../components/layout';
import {formatNumber} from './Stat';

type Props = {scene: SceneOf<'chart'>};

const decimalsFor = (values: number[]) => (values.every(Number.isInteger) ? 0 : 1);

export const ChartScene: React.FC<Props> = ({scene}) => {
  const theme = useTheme();
  const {u, portrait, width, height, pad, safeBottom} = useLayout();
  const head = useEnter(4);
  const chartWidth = Math.min(width - pad * 2, 1500 * u);
  const chartHeight = Math.min(
    (portrait ? 0.4 : 0.5) * height,
    height - pad * 2 - safeBottom - (scene.heading ? 330 : 190) * u,
  );

  return (
    <SceneFrame>
      {scene.heading ? (
        <div style={{marginBottom: 56 * u, ...riseIn(head, 30 * u)}}>
          <Heading size={(portrait ? 78 : 88) * u}>{scene.heading}</Heading>
        </div>
      ) : null}
      <div style={{width: chartWidth, fontFamily: theme.fonts.body}}>
        {scene.kind === 'bar' ? (
          <Bars scene={scene} width={chartWidth} height={chartHeight} />
        ) : (
          <Line scene={scene} width={chartWidth} height={chartHeight} />
        )}
      </div>
    </SceneFrame>
  );
};

const Bars: React.FC<Props & {width: number; height: number}> = ({scene, width, height}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const {u, fps, durationInFrames} = useLayout();
  const {data} = scene;
  const max = Math.max(...data.map((d) => d.value), 1e-9);
  const decimals = decimalsFor(data.map((d) => d.value));
  const step = Math.max(4, Math.min(14, (durationInFrames * 0.45) / data.length));
  const gap = Math.min(48 * u, (width / data.length) * 0.28);
  const labelSize = Math.min(40 * u, (width / data.length) * 0.24) * theme.bodyScale;
  const valueSize = labelSize * 1.15;
  const plot = height - valueSize * 1.6;

  return (
    <div>
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'flex-end',
          gap,
          borderBottom: `${4 * u}px solid ${theme.colors.ink}`,
        }}
      >
        {data.map((d, i) => {
          const p = spring({frame: frame - 14 - i * step, fps, config: {damping: 18, mass: 0.8}});
          const grown = Math.max(0, p);
          const isMax = d.value === max;
          return (
            <div key={i} style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              <div
                style={{
                  fontSize: valueSize,
                  fontWeight: 700,
                  marginBottom: 10 * u,
                  opacity: Math.min(1, grown * 2),
                  fontVariantNumeric: 'tabular-nums',
                  color: isMax ? theme.colors.accent : theme.colors.ink,
                  whiteSpace: 'nowrap',
                }}
              >
                {formatNumber(d.value * Math.min(1, grown), decimals)}
                {scene.unit}
              </div>
              <div
                style={{
                  width: '100%',
                  height: (d.value / max) * plot * grown,
                  background: isMax
                    ? `linear-gradient(180deg, ${theme.colors.accent}, ${theme.colors.accent2})`
                    : theme.colors.accent2,
                  opacity: isMax ? 1 : 0.78,
                  borderRadius: `${theme.radius * 0.5 * u}px ${theme.radius * 0.5 * u}px 0 0`,
                  border: theme.scrapbook ? `${3 * u}px solid ${theme.colors.ink}` : 'none',
                  borderBottom: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{display: 'flex', gap, marginTop: 18 * u}}>
        {data.map((d, i) => (
          <div
            key={i}
            style={{flex: 1, textAlign: 'center', fontSize: labelSize, color: theme.colors.muted, lineHeight: 1.15}}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
};

const Line: React.FC<Props & {width: number; height: number}> = ({scene, width, height}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const {u, fps, durationInFrames} = useLayout();
  const {data} = scene;
  const max = Math.max(...data.map((d) => d.value), 1e-9);
  const decimals = decimalsFor(data.map((d) => d.value));
  const labelSize = Math.min(38 * u, (width / data.length) * 0.24) * theme.bodyScale;
  const top = labelSize * 2.2;
  const inset = width / data.length / 2;
  const points = data.map((d, i) => ({
    x: inset + (i * (width - inset * 2)) / (data.length - 1),
    y: top + (1 - d.value / max) * (height - top),
  }));

  // Cumulative length so the pen and the dots stay in sync.
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const total = lengths[lengths.length - 1];
  const drawFrames = Math.max(20, Math.min(80, durationInFrames * 0.5));
  const drawn = interpolate(frame, [14, 14 + drawFrames], [0, total], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const area = `${path} L${points[points.length - 1].x} ${height} L${points[0].x} ${height} Z`;

  return (
    <div>
      <div style={{position: 'relative', height, borderBottom: `${4 * u}px solid ${theme.colors.ink}`}}>
        <svg width={width} height={height} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
          <defs>
            <clipPath id="line-reveal">
              <rect x={0} y={0} width={interpolate(drawn, lengths, points.map((p) => p.x))} height={height} />
            </clipPath>
          </defs>
          <path d={area} fill={theme.colors.accent2} opacity={0.14} clipPath="url(#line-reveal)" />
          <path
            d={path}
            fill="none"
            stroke={theme.colors.accent}
            strokeWidth={8 * u}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={total}
            strokeDashoffset={total - drawn}
          />
        </svg>
        {points.map((p, i) => {
          const reachedAt = interpolate(lengths[i], [0, total], [14, 14 + drawFrames]);
          const pop = spring({frame: frame - reachedAt, fps, config: {damping: 11, mass: 0.5}});
          const dot = 26 * u;
          return (
            <React.Fragment key={i}>
              <div
                style={{
                  position: 'absolute',
                  left: p.x - dot / 2,
                  top: p.y - dot / 2,
                  width: dot,
                  height: dot,
                  borderRadius: '50%',
                  background: theme.colors.bg,
                  border: `${6 * u}px solid ${theme.colors.accent}`,
                  boxSizing: 'border-box',
                  transform: `scale(${pop})`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: p.x - 150 * u,
                  width: 300 * u,
                  top: p.y - labelSize * 2,
                  textAlign: 'center',
                  fontSize: labelSize * 1.1,
                  fontWeight: 700,
                  opacity: Math.min(1, Math.max(0, pop)),
                  whiteSpace: 'nowrap',
                }}
              >
                {formatNumber(d(data, i), decimals)}
                {scene.unit}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{display: 'flex', marginTop: 18 * u}}>
        {data.map((item, i) => (
          <div
            key={i}
            style={{flex: 1, textAlign: 'center', fontSize: labelSize, color: theme.colors.muted, lineHeight: 1.15}}
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
};

const d = (data: {value: number}[], i: number) => data[i].value;
