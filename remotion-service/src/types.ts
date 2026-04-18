import { z } from "zod";

export const SubtitleSegmentSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
});

export const CodeSnippetSchema = z.object({
  language: z.string(),
  code: z.string(),
  caption: z.string().optional(),
});

export const RenderPropsSchema = z.object({
  template: z.enum(["tech-dark", "minimal", "bold", "reel"]),
  resolution: z.enum(["shorts", "landscape", "square"]),
  script: z.string(),
  subtitles: z.array(SubtitleSegmentSchema),
  images: z.array(z.string()).nullish(),
  code_snippets: z.array(CodeSnippetSchema).nullish(),
  audio_path: z.string().nullish(),
  music_track: z.string().nullish(),
  music_volume: z.number().min(0).max(1).default(0.15),
  language: z.string().default("en"),
  output_path: z.string(),
  fps: z.number().default(30),
});

export type SubtitleSegment = z.infer<typeof SubtitleSegmentSchema>;
export type CodeSnippet = z.infer<typeof CodeSnippetSchema>;
export type RenderProps = z.infer<typeof RenderPropsSchema>;
export type Template = RenderProps["template"];
export type Resolution = RenderProps["resolution"];

export interface RenderResult {
  video_path: string;
  duration_seconds: number;
  file_size_bytes: number;
}

export const RESOLUTIONS: Record<Resolution, { width: number; height: number }> = {
  shorts:    { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
  square:    { width: 1080, height: 1080 },
};

export const TEMPLATES: Template[] = ["tech-dark", "minimal", "bold", "reel"];
