import React from "react";
import { AbsoluteFill, Sequence, Audio, useVideoConfig, useCurrentFrame, interpolate, spring, staticFile } from "remotion";
import { RenderProps } from "../types";
import { ImageScene } from "../components/ImageScene";
import { SubtitleWord } from "../components/SubtitleWord";

// Vivid gradient presets for Reel — changes per scene
const GRADIENTS = [
  ["#1a1a2e", "#16213e"],
  ["#0f0c29", "#302b63"],
  ["#1e3c72", "#2a5298"],
  ["#000428", "#004e92"],
  ["#200122", "#6f0000"],
  ["#11998e", "#38ef7d"],
];

function SceneBackground({ index, durationFrames }: { index: number; durationFrames: number }) {
  const frame = useCurrentFrame();
  const [c1, c2] = GRADIENTS[index % GRADIENTS.length];
  const angle = interpolate(frame, [0, durationFrames], [135, 160]);
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      background: `linear-gradient(${angle}deg, ${c1}, ${c2})`,
    }} />
  );
}

function ActiveWordHighlight({ fps }: { fps: number }) {
  const frame = useCurrentFrame();
  // Pulse effect behind active word area
  const pulse = spring({ frame: frame % Math.round(fps * 0.5), fps, config: { damping: 10 } });
  return (
    <div style={{
      position: "absolute",
      bottom: 80,
      left: "10%",
      right: "10%",
      height: 80,
      background: `rgba(255,255,255,${pulse * 0.04})`,
      borderRadius: 12,
      pointerEvents: "none",
    }} />
  );
}

export const Reel: React.FC<RenderProps> = ({
  subtitles,
  images,
  audio_path,
  fps = 30,
  music_track,
  music_volume = 0.2,
}) => {
  const { durationInFrames } = useVideoConfig();
  const imgs = images ?? [];

  // Reel uses shorter scene durations — more cuts = more energy
  const sceneDuration = imgs.length > 0
    ? Math.floor(durationInFrames / imgs.length)
    : durationInFrames;

  return (
    <AbsoluteFill>
      {/* Scenes — each has own gradient bg + optional image */}
      {Array.from({ length: Math.max(imgs.length, 1) }).map((_, i) => {
        const from = i * sceneDuration;
        const duration = i === Math.max(imgs.length, 1) - 1
          ? durationInFrames - from
          : sceneDuration;

        return (
          <Sequence key={i} from={from} durationInFrames={duration}>
            <SceneBackground index={i} durationFrames={duration} />
            {imgs[i] && (
              <ImageScene src={imgs[i]} sceneDurationFrames={duration} index={i} />
            )}
          </Sequence>
        );
      })}

      {/* Bottom gradient — heavy, for legibility */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: 380,
        background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* Pulse highlight behind subtitles */}
      <ActiveWordHighlight fps={fps} />

      {/* Reel-style subtitles — larger, more centered */}
      {subtitles.length > 0 && (
        <SubtitleWord
          subtitles={subtitles}
          color="#FFFFFF"
          highlightColor="#FACC15"
          fontSize={60}
          bottomOffset={90}
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
