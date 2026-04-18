import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Img } from "remotion";

interface Props {
  src: string;
  sceneDurationFrames: number;
  index?: number;
}

export const ImageScene: React.FC<Props> = ({ src, sceneDurationFrames, index = 0 }) => {
  const frame = useCurrentFrame();

  const progress = Math.min(frame / sceneDurationFrames, 1);

  // Alternate Ken Burns direction by scene index
  const even = index % 2 === 0;
  const scale = interpolate(progress, [0, 1], even ? [1.0, 1.15] : [1.15, 1.0]);
  const translateX = interpolate(progress, [0, 1], even ? [0, -2] : [2, 0]);
  const translateY = interpolate(progress, [0, 1], even ? [0, -1.5] : [1.5, 0]);

  // Fade in/out at scene boundaries
  const opacity = interpolate(
    frame,
    [0, 10, sceneDurationFrames - 10, sceneDurationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
        }}
      />
    </div>
  );
};
