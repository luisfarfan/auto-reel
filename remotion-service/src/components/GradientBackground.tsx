import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface Props {
  colors?: [string, string];
  animate?: boolean;
}

export const GradientBackground: React.FC<Props> = ({
  colors = ["#0d1117", "#161b22"],
  animate = true,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const angle = animate
    ? interpolate(frame, [0, durationInFrames], [135, 225])
    : 135;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(${angle}deg, ${colors[0]}, ${colors[1]})`,
      }}
    />
  );
};
