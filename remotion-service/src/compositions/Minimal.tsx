import React from "react";
import { AbsoluteFill, Sequence, Audio, useVideoConfig, useCurrentFrame, staticFile } from "remotion";
import { RenderProps } from "../types";
import { SubtitleWord } from "../components/SubtitleWord";
import { ImageScene } from "../components/ImageScene";

const DarkOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Subtle vignette that stays constant
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)",
      pointerEvents: "none",
    }} />
  );
};

export const Minimal: React.FC<RenderProps> = ({
  subtitles,
  images,
  audio_path,
  fps = 30,
  music_track,
  music_volume = 0.15,
}) => {
  const { durationInFrames } = useVideoConfig();
  const imgs = images ?? [];

  const sceneDuration = imgs.length > 0
    ? Math.floor(durationInFrames / imgs.length)
    : durationInFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: "#111" }}>
      {/* Image scenes */}
      {imgs.map((src, i) => {
        const from = i * sceneDuration;
        const duration = i === imgs.length - 1
          ? durationInFrames - from
          : sceneDuration;

        return (
          <Sequence key={i} from={from} durationInFrames={duration}>
            <ImageScene src={src} sceneDurationFrames={duration} index={i} />
          </Sequence>
        );
      })}

      {/* Vignette */}
      <DarkOverlay />

      {/* Bottom gradient for subtitle legibility */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 340,
        background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* Subtitles */}
      {subtitles.length > 0 && (
        <SubtitleWord
          subtitles={subtitles}
          color="#FFFFFF"
          highlightColor="#FACC15"
          fontSize={54}
          bottomOffset={110}
        />
      )}

      {/* TTS voice */}
      {audio_path && <Audio src={audio_path} />}

      {/* Background music */}
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
