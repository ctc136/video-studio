import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {useLayout, useTheme} from './layout';

const GraphPaper: React.FC = () => {
  const {u, portrait, width} = useLayout();
  const cell = 36 * u;
  const major = cell * 5;
  const minorLine = 'rgba(64, 120, 190, 0.16)';
  const majorLine = 'rgba(64, 120, 190, 0.3)';
  const margin = (portrait ? 0.075 : 0.06) * width;
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          backgroundImage: [
            `linear-gradient(${majorLine} ${2 * u}px, transparent ${2 * u}px)`,
            `linear-gradient(90deg, ${majorLine} ${2 * u}px, transparent ${2 * u}px)`,
            `linear-gradient(${minorLine} ${1.5 * u}px, transparent ${1.5 * u}px)`,
            `linear-gradient(90deg, ${minorLine} ${1.5 * u}px, transparent ${1.5 * u}px)`,
          ].join(','),
          backgroundSize: `${major}px ${major}px, ${major}px ${major}px, ${cell}px ${cell}px, ${cell}px ${cell}px`,
        }}
      />
      {/* Red margin rule and punch holes */}
      <div
        style={{
          position: 'absolute',
          left: margin,
          top: 0,
          bottom: 0,
          width: 3 * u,
          background: 'rgba(228, 87, 46, 0.5)',
        }}
      />
      {[0.16, 0.5, 0.84].map((y) => (
        <div
          key={y}
          style={{
            position: 'absolute',
            left: margin / 2 - 15 * u,
            top: `calc(${y * 100}% - ${15 * u}px)`,
            width: 30 * u,
            height: 30 * u,
            borderRadius: '50%',
            background: '#e9e4d4',
            boxShadow: `inset 0 ${3 * u}px ${5 * u}px rgba(0,0,0,0.22)`,
          }}
        />
      ))}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(120, 100, 60, 0.13) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

const Glow: React.FC = () => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const {u} = useLayout();
  const drift = (speed: number, phase: number) => Math.sin(frame / speed + phase) * 6;
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(circle at ${22 + drift(50, 0)}% ${24 + drift(70, 1)}%, ${theme.colors.accent2}66 0%, transparent 42%)`,
            `radial-gradient(circle at ${80 + drift(60, 2)}% ${78 + drift(45, 3)}%, ${theme.colors.accent}3d 0%, transparent 40%)`,
            `radial-gradient(circle at 60% 10%, #2b3a8a55 0%, transparent 45%)`,
          ].join(','),
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.11) ${1.5 * u}px, transparent ${1.5 * u}px)`,
          backgroundSize: `${44 * u}px ${44 * u}px`,
        }}
      />
    </AbsoluteFill>
  );
};

const Sun: React.FC = () => {
  const frame = useCurrentFrame();
  const {u, height} = useLayout();
  const size = 900 * u;
  const rise = Math.min(1, frame / 240) * 90 * u;
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(165deg, #fff3e0 0%, #ffd9b8 45%, #ffb199 78%, #ff8f8f 100%)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `calc(50% - ${size / 2}px)`,
          top: height - size * 0.42 - rise,
          width: size,
          height: size,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,246,214,0.95) 0%, rgba(255,214,140,0.75) 45%, rgba(255,180,120,0) 70%)',
        }}
      />
    </AbsoluteFill>
  );
};

export const Background: React.FC = () => {
  const theme = useTheme();
  if (theme.background === 'graph-paper') return <GraphPaper />;
  if (theme.background === 'glow') return <Glow />;
  return <Sun />;
};
