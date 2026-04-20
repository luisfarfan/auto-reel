import React from "react";
import { AbsoluteFill, Sequence, Audio, useVideoConfig, useCurrentFrame, interpolate, staticFile } from "remotion";
import { RenderProps } from "../types";
import { ImageScene } from "../components/ImageScene";
import { SubtitleWord } from "../components/SubtitleWord";

// Actually vivid gradients — not dark navy
const GRADIENTS: [string, string][] = [
  ["#FF006E", "#8338EC"],  // hot pink → purple
  ["#FB5607", "#FF006E"],  // orange → pink
  ["#3A86FF", "#8338EC"],  // blue → purple
  ["#06D6A0", "#118AB2"],  // teal → ocean
  ["#FFD60A", "#FB5607"],  // yellow → orange
  ["#FF006E", "#3A86FF"],  // pink → blue
];

function SceneBackground({ index, durationFrames }: { index: number; durationFrames: number }) {
  const frame = useCurrentFrame();
  const [c1, c2] = GRADIENTS[index % GRADIENTS.length];
  const angle = interpolate(frame, [0, durationFrames], [135, 165]);
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      background: `linear-gradient(${angle}deg, ${c1}, ${c2})`,
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

  const sceneCount = Math.max(imgs.length, 1);
  const sceneDuration = Math.floor(durationInFrames / sceneCount);

  return (
    <AbsoluteFill>
      {Array.from({ length: sceneCount }).map((_, i) => {
        const from = i * sceneDuration;
        const duration = i === sceneCount - 1 ? durationInFrames - from : sceneDuration;

        return (
          <Sequence key={i} from={from} durationInFrames={duration}>
            <SceneBackground index={i} durationFrames={duration} />
            {imgs[i] && (
              <ImageScene src={imgs[i]} sceneDurationFrames={duration} index={i} />
            )}
          </Sequence>
        );
      })}

      {/* Heavy bottom gradient for legibility */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: 420,
        background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* TikTok-style karaoke subtitles — 1 word, pill background */}
      {subtitles.length > 0 && (
        <SubtitleWord
          subtitles={subtitles}
          color="#FFFFFF"
          highlightColor="#FFD60A"
          fontSize={72}
          bottomOffset={110}
          mode="karaoke"
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
