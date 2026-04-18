import React from "react";
import { useCurrentFrame, spring, useVideoConfig } from "remotion";
import { SubtitleSegment } from "../types";

interface Props {
  subtitles: SubtitleSegment[];
  color?: string;
  highlightColor?: string;
  fontSize?: number;
  bottomOffset?: number;
}

export const SubtitleWord: React.FC<Props> = ({
  subtitles,
  color = "#FFFFFF",
  highlightColor = "#FFD700",
  fontSize = 52,
  bottomOffset = 120,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const activeIndex = subtitles.findIndex(
    (s) => currentTime >= s.start && currentTime <= s.end,
  );

  // Show a sliding window of 3 words around the active word
  const windowStart = Math.max(0, activeIndex - 0);
  const window = subtitles.slice(windowStart, windowStart + 3);

  if (window.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: bottomOffset,
        left: 0,
        right: 0,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 10,
        padding: "0 48px",
      }}
    >
      {window.map((seg, i) => {
        const isActive = windowStart + i === activeIndex;
        const enterFrame = Math.max(0, frame - Math.round(seg.start * fps));

        const scale = isActive
          ? spring({ frame: enterFrame, fps, config: { damping: 15, stiffness: 200 }, from: 0.85, to: 1.1 })
          : 1;

        return (
          <span
            key={`${seg.start}-${i}`}
            style={{
              fontSize,
              fontWeight: 900,
              color: isActive ? highlightColor : color,
              textShadow: "0 2px 12px rgba(0,0,0,0.9)",
              transform: `scale(${scale})`,
              display: "inline-block",
              fontFamily: "system-ui, -apple-system, sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            {seg.word}
          </span>
        );
      })}
    </div>
  );
};
