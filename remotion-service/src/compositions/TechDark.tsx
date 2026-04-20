import React from "react";
import { AbsoluteFill, Sequence, Audio, useVideoConfig, staticFile } from "remotion";
import { RenderProps } from "../types";
import { GradientBackground } from "../components/GradientBackground";
import { SubtitleWord } from "../components/SubtitleWord";
import { CodeBlock } from "../components/CodeBlock";
import { ImageScene } from "../components/ImageScene";
import { CodeSnippet } from "../types";

type Scene =
  | { type: "code"; data: CodeSnippet }
  | { type: "image"; data: string };

// Interleave code snippets and images: [code, image, code, image, ...]
function buildScenes(snippets: CodeSnippet[], imgs: string[]): Scene[] {
  const scenes: Scene[] = [];
  const maxLen = Math.max(snippets.length, imgs.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < snippets.length) scenes.push({ type: "code", data: snippets[i] });
    if (i < imgs.length) scenes.push({ type: "image", data: imgs[i] });
  }
  return scenes;
}

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
  const scenes = buildScenes(snippets, imgs);

  const sceneFrames = scenes.length > 0
    ? Math.floor(durationInFrames / scenes.length)
    : durationInFrames;

  return (
    <AbsoluteFill>
      <GradientBackground colors={["#0d1117", "#161b22"]} animate />

      {scenes.map((scene, i) => {
        const from = i * sceneFrames;
        const duration = i === scenes.length - 1
          ? durationInFrames - from
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

      {subtitles.length > 0 && (
        <SubtitleWord
          subtitles={subtitles}
          color="#FFFFFF"
          highlightColor="#60a5fa"
          fontSize={48}
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
