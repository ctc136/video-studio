import React from 'react';
import {Composition, type CalculateMetadataFunction} from 'remotion';
import sample from '../../storyboards/sample.json';
import {ASPECTS, FPS, parseStoryboard} from '../shared/schema';
import {buildTimeline} from '../shared/timeline';
import {StoryboardVideo, type StoryboardVideoProps} from './Video';

/** Size and length come from the storyboard passed in as input props. */
const calculateMetadata: CalculateMetadataFunction<StoryboardVideoProps> = ({props}) => {
  const storyboard = parseStoryboard(props.storyboard);
  const {width, height} = ASPECTS[props.aspect] ?? ASPECTS['16:9'];
  return {
    durationInFrames: buildTimeline(storyboard).totalFrames,
    fps: FPS,
    width,
    height,
    props: {...props, storyboard},
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Storyboard"
      component={StoryboardVideo}
      durationInFrames={300}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{storyboard: parseStoryboard(sample), aspect: '16:9' as const}}
      calculateMetadata={calculateMetadata}
    />
  );
};
