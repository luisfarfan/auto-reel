import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { CodeSnippet } from "../types";
import { CodeBlock } from "./CodeBlock";
import { ImageScene } from "./ImageScene";

interface Props {
  snippet: CodeSnippet;
  imageSrc?: string;
  rightContent?: React.ReactNode;
  startFrame?: number;
  accentColor?: string;
  dividerAnimated?: boolean;
}

export const SplitScreen: React.FC<Props> = ({
  snippet,
  imageSrc,
  rightContent,
  startFrame = 0,
  accentColor = "#60a5fa",
  dividerAnimated = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const relativeFrame = Math.max(0, frame - startFrame);

  // Left panel slides in from left
  const leftX = spring({
    frame: relativeFrame,
    fps,
    config: { damping: 20, stiffness: 100 },
    from: -80,
    to: 0,
  });

  // Right panel slides in from right
  const rightX = spring({
    frame: relativeFrame,
    fps,
    config: { damping: 20, stiffness: 100 },
    from: 80,
    to: 0,
  });

  // Divider grows from 0 to full height
  const dividerH = dividerAnimated
    ? spring({ frame: relativeFrame, fps, config: { damping: 25, stiffness: 80 }, from: 0, to: 1 })
    : 1;

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      overflow: "hidden",
    }}>
      {/* Left panel — code */}
      <div style={{
        flex: 1,
        position: "relative",
        transform: `translateX(${leftX}px)`,
        overflow: "hidden",
        background: "rgba(13,17,23,0.97)",
      }}>
        <CodeBlock snippet={snippet} startFrame={startFrame} />
      </div>

      {/* Divider */}
      <div style={{
        width: 3,
        alignSelf: "center",
        height: `${dividerH * 85}%`,
        background: `linear-gradient(to bottom, transparent, ${accentColor}, transparent)`,
        flexShrink: 0,
        borderRadius: 2,
      }} />

      {/* Right panel — image or custom content */}
      <div style={{
        flex: 1,
        position: "relative",
        transform: `translateX(${rightX}px)`,
        overflow: "hidden",
        background: "#111",
      }}>
        {imageSrc ? (
          <ImageScene
            src={imageSrc}
            sceneDurationFrames={durationInFrames - startFrame}
            index={1}
          />
        ) : (
          rightContent
        )}
      </div>
    </div>
  );
};
