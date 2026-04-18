import React from "react";
import { AbsoluteFill, Sequence, Audio, useVideoConfig, staticFile } from "remotion";
import { RenderProps } from "../types";
import { GradientBackground } from "../components/GradientBackground";
import { SubtitleWord } from "../components/SubtitleWord";
import { CodeBlock } from "../components/CodeBlock";
import { ImageScene } from "../components/ImageScene";

export const TechDark: React.FC<RenderProps> = ({
  script,
  subtitles,
  code_snippets,
  images,
  audio_path,
  fps = 30,
  music_track,
  music_volume = 0.15,
}) => {
  const { durationInFrames } = useVideoConfig();

  const snippets = code_snippets ?? [];
  const imgs = images ?? [];
  const scenes = [...snippets.map((s) => ({ type: "code" as const, data: s })),
                  ...imgs.map((src) => ({ type: "image" as const, data: src }))];

  const sceneFrames = scenes.length > 0
    ? Math.floor(durationInFrames / scenes.length)
    : durationInFrames;

  return (
    <AbsoluteFill>
      <GradientBackground colors={["#0d1117", "#161b22"]} animate />

      {/* Scenes */}
      {scenes.map((scene, i) => {
        const from = i * sceneFrames;
        const duration = i === scenes.length - 1
          ? durationInFrames - from   // last scene takes remainder
          : sceneFrames;

        return (
          <Sequence key={i} from={from} durationInFrames={duration}>
            {scene.type === "code" ? (
              <CodeBlock snippet={scene.data} startFrame={0} />
            ) : (
              <ImageScene src={scene.data} sceneDurationFrames={duration} index={i} />
            )}
          </Sequence>
        );
      })}

      {/* Subtitles always on top */}
      {subtitles.length > 0 && (
        <SubtitleWord
          subtitles={subtitles}
          color="#FFFFFF"
          highlightColor="#60a5fa"
          fontSize={48}
          bottomOffset={100}
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
