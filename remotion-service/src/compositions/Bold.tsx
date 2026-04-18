import React from "react";
import { AbsoluteFill, Sequence, Audio, useVideoConfig, useCurrentFrame, interpolate, spring, staticFile } from "remotion";
import { RenderProps } from "../types";
import { ImageScene } from "../components/ImageScene";
import { SubtitleWord } from "../components/SubtitleWord";
import { TitleCard } from "../components/TitleCard";

const ACCENT_COLORS = ["#f43f5e", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"];

function FlashOverlay({ frame, fps }: { frame: number; fps: number }) {
  // Brief white flash on scene cuts
  const flash = interpolate(
    frame % Math.round(fps * 3),
    [0, 3, 8],
    [0.25, 0, 0],
    { extrapolateRight: "clamp" },
  );
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
  const frame = useCurrentFrame();
  const imgs = images ?? [];

  // Title card: first 2.5s
  const titleFrames = Math.round(fps * 2.5);
  const accent = ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];

  // Image scenes after title card
  const remainingFrames = durationInFrames - titleFrames;
  const sceneDuration = imgs.length > 0
    ? Math.floor(remainingFrames / imgs.length)
    : remainingFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Image scenes */}
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

      {/* Dark overlay for contrast */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        pointerEvents: "none",
      }} />

      {/* Bottom gradient */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: 400,
        background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)",
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

      {/* Flash on scene cuts */}
      <FlashOverlay frame={frame} fps={fps} />

      {/* Bold subtitles */}
      {subtitles.length > 0 && (
        <SubtitleWord
          subtitles={subtitles}
          color="#FFFFFF"
          highlightColor={accent}
          fontSize={58}
          bottomOffset={100}
        />
      )}

      {/* TTS voice */}
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
