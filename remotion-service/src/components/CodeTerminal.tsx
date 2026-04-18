import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { CodeSnippet } from "../types";

interface Props {
  snippet: CodeSnippet;
  startFrame?: number;
  charsPerSecond?: number;
  title?: string;
}

const LANG_COLOR: Record<string, string> = {
  typescript: "#3b82f6",
  javascript: "#f59e0b",
  python:     "#10b981",
  rust:       "#f97316",
  go:         "#06b6d4",
  java:       "#ef4444",
  bash:       "#a3e635",
  shell:      "#a3e635",
};

export const CodeTerminal: React.FC<Props> = ({
  snippet,
  startFrame = 0,
  charsPerSecond = 40,
  title,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relativeFrame = Math.max(0, frame - startFrame);
  const charsVisible = Math.floor((relativeFrame / fps) * charsPerSecond);
  const visibleCode = snippet.code.slice(0, charsVisible);

  const cursorVisible = Math.floor(relativeFrame / Math.round(fps * 0.5)) % 2 === 0;

  const opacity = spring({
    frame: relativeFrame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const accentColor = LANG_COLOR[snippet.language.toLowerCase()] ?? "#a78bfa";
  const displayTitle = title ?? snippet.caption ?? snippet.language;

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: "32px 28px",
      opacity,
    }}>
      {/* Terminal window */}
      <div style={{
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 16px 60px rgba(0,0,0,0.7)",
        background: "#1e1e1e",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        {/* Title bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          background: "#2d2d2d",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          {/* Window dots */}
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />
          ))}
          <span style={{
            flex: 1,
            textAlign: "center",
            fontSize: 13,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "monospace",
            marginRight: 36,
          }}>
            {displayTitle}
          </span>
          {/* Lang badge */}
          <span style={{
            fontSize: 11,
            color: accentColor,
            fontFamily: "monospace",
            fontWeight: 700,
            background: `${accentColor}22`,
            padding: "2px 8px",
            borderRadius: 4,
          }}>
            {snippet.language}
          </span>
        </div>

        {/* Code body */}
        <div style={{
          padding: "20px 20px",
          fontFamily: "'Fira Code', 'Cascadia Code', monospace",
          fontSize: 22,
          lineHeight: 1.7,
          color: "#d4d4d4",
          minHeight: 200,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {visibleCode}
          {cursorVisible && (
            <span style={{
              display: "inline-block",
              width: 2,
              height: "1.1em",
              background: accentColor,
              verticalAlign: "text-bottom",
              marginLeft: 1,
            }} />
          )}
        </div>
      </div>
    </div>
  );
};
