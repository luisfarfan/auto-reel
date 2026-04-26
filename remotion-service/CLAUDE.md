# remotion-service/ — Claude Code Guide

Node.js TypeScript microservice. Renders React components to MP4 via Remotion 4 + Chromium.

## Structure

```
remotion-service/src/
  server.ts         Express app: POST /render, GET /health, static GET /media
  renderer.ts       Webpack bundle cache (warmBundle) + renderMedia()
  types.ts          Zod schema for RenderProps (input validation)
  compositions/     React compositions (TechDark, Minimal, Bold, Reel)
  components/       Shared React components used across templates
    GradientBackground.tsx
    SubtitleWord.tsx    Per-word TikTok-style subtitles with pulse animation
    ImageScene.tsx      Ken Burns pan/zoom effect
    CodeBlock.tsx       Syntax-highlighted code
    TitleCard.tsx       Animated intro card
    CodeTerminal.tsx    Terminal-style code animation
    SplitScreen.tsx     Side-by-side layout
```

## Critical: Bundle Cache

The Webpack bundle is built **once** at startup via `warmBundle()`.

**Must restart this service after modifying any composition or component.**

```bash
npm run dev   # restart = Ctrl+C + npm run dev
```

Wait for `Bundle ready` in logs before triggering a render.

## Render API

```http
POST http://localhost:3001/render
Content-Type: application/json

{
  "template": "tech-dark",          // "tech-dark"|"minimal"|"bold"|"reel"
  "resolution": "shorts",           // "shorts"|"landscape"|"square"
  "script": "...",
  "subtitles": [{ "word": "Hello", "start": 0.0, "end": 0.4 }],
  "audio_path": "/abs/path/tts.mp3",
  "images": ["/abs/path/img1.png"],
  "code_snippets": [{ "language": "python", "code": "...", "caption": "..." }],
  "music_track": "lofi.mp3",        // optional, file in assets/music/
  "music_volume": 0.15,             // 0.0-1.0, default 0.15
  "language": "en",
  "output_path": "/abs/path/out.mp4",
  "fps": 30
}
```

Response: `{ "success": true, "output_path": "..." }`

Media served at: `http://localhost:3001/media/{filename}` (serves `.mp/` directory)

## Resolutions

| Key | Dimensions |
|---|---|
| `shorts` | 1080 × 1920 |
| `landscape` | 1920 × 1080 |
| `square` | 1080 × 1080 |

## Adding a Template

1. Create `src/compositions/MyTemplate.tsx`
2. Register in `src/compositions/index.ts`
3. Add to `template` union in `src/types.ts` (Zod schema)
4. Restart service

## Dev Commands

```bash
npm run dev      # development server with hot reload (port 3001)
npm run build    # TypeScript compile
```

Full feature doc → [../docs/features/tech-video.md](../docs/features/tech-video.md)
