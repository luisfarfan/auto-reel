import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

interface Props {
  title: string;
  subtitle?: string;
  accentColor?: string;
  durationFrames?: number;
}

export const TitleCard: React.FC<Props> = ({
  title,
  subtitle,
  accentColor = "#60a5fa",
  durationFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const dur = durationFrames ?? durationInFrames;

  const slideY = spring({ frame, fps, config: { damping: 18, stiffness: 120 }, from: 60, to: 0 });
  const opacity = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });

  // Fade out last 0.4s
  const fadeOut = interpolate(
    frame,
    [dur - Math.round(fps * 0.4), dur],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const words = title.split(" ");

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 48px",
        opacity: opacity * fadeOut,
        transform: `translateY(${slideY}px)`,
      }}
    >
      {/* Accent line */}
      <div style={{
        width: 56,
        height: 4,
        borderRadius: 2,
        backgroundColor: accentColor,
        marginBottom: 24,
      }} />

      {/* Title */}
      <h1 style={{
        fontSize: 64,
        fontWeight: 900,
        textAlign: "center",
        lineHeight: 1.1,
        letterSpacing: "-0.02em",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#FFFFFF",
        textShadow: "0 4px 24px rgba(0,0,0,0.6)",
        margin: 0,
      }}>
        {words.map((word, i) => (
          <span key={i} style={{ color: i === 0 ? accentColor : "#FFFFFF" }}>
            {word}{i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </h1>

      {/* Subtitle */}
      {subtitle && (
        <p style={{
          marginTop: 16,
          fontSize: 28,
          color: "rgba(255,255,255,0.65)",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          fontWeight: 400,
          letterSpacing: "0.01em",
        }}>
          {subtitle}
        </p>
      )}
    </div>
  );
};
