import React from "react";
import { AbsoluteFill, Sequence, Audio, useVideoConfig, useCurrentFrame, interpolate, staticFile } from "remotion";
import { RenderProps } from "../types";
import { ImageScene } from "../components/ImageScene";
import { SubtitleWord } from "../components/SubtitleWord";
import { TitleCard } from "../components/TitleCard";

const ACCENT_COLORS = ["#f43f5e", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"];

// Deterministic color from script content — no random() in render
function pickAccent(script: string): string {
  const hash = script.split("").reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xfffffff, 0);
  return ACCENT_COLORS[hash % ACCENT_COLORS.length];
}

function FlashOverlay({ sceneBoundaries }: { sceneBoundaries: number[] }) {
  const frame = useCurrentFrame();

  const nearestBoundary = sceneBoundaries.find(b => frame >= b && frame < b + 10);
  if (nearestBoundary === undefined) return null;

  const localFrame = frame - nearestBoundary;
  const flash = interpolate(localFrame, [0, 2, 10], [0.4, 0.15, 0], { extrapolateRight: "clamp" });

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      background: `rgba(255,255,255,${flash})`,
      pointerEvents: "none",
    }} />
  );
}

export const Bold: React.FC<RenderProps> = ({
  script,
  subtitles,
  images,
  audio_path,
  fps = 30,
  music_track,
  music_volume = 0.18,
}) => {
  const { durationInFrames } = useVideoConfig();
  const imgs = images ?? [];

  const titleFrames = Math.round(fps * 2.5);
  const accent = pickAccent(script);

  const remainingFrames = durationInFrames - titleFrames;
  const sceneDuration = imgs.length > 0
    ? Math.floor(remainingFrames / imgs.length)
    : remainingFrames;

  // Flash at every real scene boundary
  const sceneBoundaries = [
    titleFrames,
    ...imgs.map((_, i) => titleFrames + (i + 1) * sceneDuration).filter(f => f < durationInFrames),
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {imgs.map((src, i) => {
        const from = titleFrames + i * sceneDuration;
        const duration = i === imgs.length - 1
          ? durationInFrames - from
          : sceneDuration;
        return (
          <Sequence key={i} from={from} durationInFrames={duration}>
            <ImageScene src={src} sceneDurationFrames={duration} index={i} />
          </Sequence>
        );
      })}

      {/* Dark overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.40)",
        pointerEvents: "none",
      }} />

      {/* Bottom gradient */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: 400,
        background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* Top accent bar */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: 6,
        background: accent,
      }} />

      {/* Title card — first 2.5s */}
      <Sequence from={0} durationInFrames={titleFrames}>
        <TitleCard
          title={script.split(" ").slice(0, 5).join(" ")}
          accentColor={accent}
          durationFrames={titleFrames}
        />
      </Sequence>

      {/* Flash on actual scene cuts */}
      <FlashOverlay sceneBoundaries={sceneBoundaries} />

      {subtitles.length > 0 && (
        <SubtitleWord
          subtitles={subtitles}
          color="#FFFFFF"
          highlightColor={accent}
          fontSize={58}
          bottomOffset={100}
        />
      )}

      {audio_path && <Audio src={audio_path} />}

      {music_track && (
        <Audio
          src={staticFile(`music/${music_track}`)}
          volume={music_volume}
          loop
        />
      )}
    </AbsoluteFill>
  );
};
