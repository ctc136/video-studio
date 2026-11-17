import {Audio} from '@remotion/media';
import {
  TransitionSeries,
  linearTiming,
  type TransitionPresentation,
} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';
import React, {useMemo} from 'react';
import {AbsoluteFill, Sequence, staticFile} from 'remotion';
import type {Aspect, Scene, Storyboard} from '../shared/schema';
import {buildTimeline} from '../shared/timeline';
import {Captions} from './components/Captions';
import {SceneProvider} from './components/layout';
import {sceneComponents} from './scenes';
import {getTheme} from './themes';

export type StoryboardVideoProps = {storyboard: Storyboard; aspect: Aspect};

type AnyPresentation = TransitionPresentation<Record<string, unknown>>;

const presentationFor = (type: Storyboard['transition']['type']): AnyPresentation => {
  if (type === 'slide') return slide({direction: 'from-right'}) as AnyPresentation;
  if (type === 'wipe') return wipe({direction: 'from-left'}) as AnyPresentation;
  return fade() as AnyPresentation;
};

const SceneRenderer: React.FC<{scene: Scene}> = ({scene}) => {
  const Component = sceneComponents[scene.template] as React.FC<{scene: Scene}>;
  return <Component scene={scene} />;
};

export const StoryboardVideo: React.FC<StoryboardVideoProps> = ({storyboard}) => {
  const timeline = useMemo(() => buildTimeline(storyboard), [storyboard]);
  const theme = getTheme(storyboard.theme);
  const {transitionFrames} = timeline;

  return (
    <AbsoluteFill style={{backgroundColor: theme.colors.bg}}>
      <TransitionSeries>
        {storyboard.scenes.flatMap((scene, i) => {
          const {durationInFrames} = timeline.scenes[i];
          const key = scene.id ?? `scene-${i}`;
          return [
            i > 0 && transitionFrames > 0 ? (
              <TransitionSeries.Transition
                key={`${key}-in`}
                presentation={presentationFor(storyboard.transition.type)}
                timing={linearTiming({durationInFrames: transitionFrames})}
              />
            ) : null,
            <TransitionSeries.Sequence key={key} durationInFrames={durationInFrames}>
              <SceneProvider value={{theme, captions: storyboard.captions, durationInFrames}}>
                <SceneRenderer scene={scene} />
              </SceneProvider>
            </TransitionSeries.Sequence>,
          ];
        })}
      </TransitionSeries>

      {timeline.scenes.map(({audio, index}) =>
        audio ? (
          <Sequence key={`${index}-${audio.src}`} from={audio.from} layout="none">
            <Audio src={staticFile(audio.src)} />
          </Sequence>
        ) : null,
      )}

      {storyboard.captions ? <Captions cues={timeline.captions} theme={theme} /> : null}
    </AbsoluteFill>
  );
};
