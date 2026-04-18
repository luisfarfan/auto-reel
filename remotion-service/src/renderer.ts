import path from "path";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { RenderProps, RenderResult, RESOLUTIONS } from "./types";

let bundleCache: string | null = null;

async function getBundle(): Promise<string> {
  if (bundleCache) return bundleCache;

  console.log("[renderer] bundling compositions...");
  bundleCache = await bundle({
    entryPoint: path.join(__dirname, "compositions/Root.tsx"),
    webpackOverride: (config) => config,
    publicDir: path.join(__dirname, "../public"),
  });
  console.log("[renderer] bundle ready:", bundleCache);
  return bundleCache;
}

// Pre-bundle at startup so first /render call is fast
export async function warmBundle(): Promise<void> {
  await getBundle();
}

const SERVICE_PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

function toMediaUrl(filePath: string): string {
  return `http://localhost:${SERVICE_PORT}/media/${path.basename(filePath)}`;
}

export async function renderVideo(props: RenderProps): Promise<RenderResult> {
  const bundleUrl = await getBundle();
  const compositionId = `${props.template}-${props.resolution}`;
  const { width, height } = RESOLUTIONS[props.resolution];
  const fps = props.fps ?? 30;

  // Duration = subtitle end time + 0.5s buffer, minimum 5s
  const durationSeconds = props.subtitles.length > 0
    ? Math.max(props.subtitles[props.subtitles.length - 1].end + 0.5, 5)
    : 30;
  const durationInFrames = Math.ceil(durationSeconds * fps);

  // Convert local file paths → HTTP URLs (Remotion's Chromium needs HTTP)
  const renderProps: RenderProps = {
    ...props,
    images: props.images?.map(toMediaUrl),
    audio_path: props.audio_path ? toMediaUrl(props.audio_path) : undefined,
  };

  const composition = await selectComposition({
    serveUrl: bundleUrl,
    id: compositionId,
    inputProps: renderProps,
  });

  await renderMedia({
    composition: {
      ...composition,
      width,
      height,
      fps,
      durationInFrames,
    },
    serveUrl: bundleUrl,
    codec: "h264",
    outputLocation: props.output_path,
    inputProps: renderProps,
    chromiumOptions: {
      disableWebSecurity: true,
    },
  });

  const stat = fs.statSync(props.output_path);

  return {
    video_path: props.output_path,
    duration_seconds: durationSeconds,
    file_size_bytes: stat.size,
  };
}
