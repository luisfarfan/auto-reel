import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import SyntaxHighlighter from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/cjs/styles/hljs";
import { CodeSnippet } from "../types";

interface Props {
  snippet: CodeSnippet;
  startFrame?: number;
  framesPerLine?: number;
}

export const CodeBlock: React.FC<Props> = ({
  snippet,
  startFrame = 0,
  framesPerLine,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lines = snippet.code.split("\n");
  const relativeFrame = Math.max(0, frame - startFrame);

  // Default: reveal one line every 0.25s
  const fpl = framesPerLine ?? Math.round(fps * 0.25);
  const visibleLines = Math.min(Math.floor(relativeFrame / fpl) + 1, lines.length);
  const visibleCode = lines.slice(0, visibleLines).join("\n");

  const opacity = spring({
    frame: relativeFrame,
    fps,
    config: { damping: 20, stiffness: 120 },
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "40px 32px",
        opacity,
      }}
    >
      {snippet.caption && (
        <p
          style={{
            color: "#8b949e",
            fontSize: 22,
            marginBottom: 14,
            fontFamily: "monospace",
            letterSpacing: "0.02em",
          }}
        >
          {`// ${snippet.caption}`}
        </p>
      )}

      <div style={{ borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}>
        <SyntaxHighlighter
          language={snippet.language}
          style={atomOneDark}
          showLineNumbers
          customStyle={{
            fontSize: 26,
            lineHeight: 1.65,
            padding: "24px 20px",
            margin: 0,
            background: "rgba(13,17,23,0.95)",
            borderRadius: 14,
            minHeight: 120,
          }}
          lineNumberStyle={{ color: "#484f58", minWidth: "2em" }}
        >
          {visibleCode}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};
