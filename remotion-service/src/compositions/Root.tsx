import React from "react";
import { Composition, registerRoot } from "remotion";
import { TechDark } from "./TechDark";
import { Minimal } from "./Minimal";
import { Bold } from "./Bold";
import { Reel } from "./Reel";
import { RESOLUTIONS, RenderProps } from "../types";

const COMPONENTS = {
  "tech-dark": TechDark,
  "minimal":   Minimal,
  "bold":      Bold,
  "reel":      Reel,
} as const;

const defaultProps: RenderProps = {
  template: "tech-dark",
  resolution: "shorts",
  script: "Sample script text.",
  subtitles: [],
  language: "en",
  output_path: "/tmp/out.mp4",
  fps: 30,
  music_volume: 0.15,
};

function computeDuration(props: RenderProps): { durationInFrames: number; fps: number } {
  const fps = props.fps ?? 30;
  const lastSub = props.subtitles[props.subtitles.length - 1];
  const durationSec = lastSub ? lastSub.end + 0.5 : 30;
  return { durationInFrames: Math.max(Math.ceil(durationSec * fps), fps * 5), fps };
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {(Object.keys(COMPONENTS) as Array<keyof typeof COMPONENTS>).map((template) =>
        (Object.keys(RESOLUTIONS) as Array<keyof typeof RESOLUTIONS>).map((resolution) => {
          const { width, height } = RESOLUTIONS[resolution];
          const Component = COMPONENTS[template];
          const id = `${template}-${resolution}`;

          return (
            <Composition
              key={id}
              id={id}
              component={Component}
              durationInFrames={900}   // default 30s, overridden by calculateMetadata
              fps={30}
              width={width}
              height={height}
              defaultProps={{ ...defaultProps, template, resolution }}
              calculateMetadata={async ({ props }) => {
                const { durationInFrames, fps } = computeDuration(props as RenderProps);
                return { durationInFrames, fps, width, height };
              }}
            />
          );
        }),
      )}
    </>
  );
};

registerRoot(RemotionRoot);
