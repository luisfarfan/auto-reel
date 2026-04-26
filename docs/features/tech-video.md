# Tech Video Pipeline (Remotion)

Triggered from the dashboard → TechVideo page. Runs as a Celery job (`remotion.generate_video`).

## Pipeline Steps

| # | Step | Service | Cost |
|---|---|---|---|
| 1 | Web Search | Tavily API | ~$0.001 |
| 2 | Generate Script | Ollama (Qwen2.5-Coder) | free |
| 3 | Generate Metadata | Ollama | free |
| 4 | Generate Code Snippets | Ollama | free |
| 5 | Generate Image Prompts | Ollama | free |
| 6 | Generate Images | fal.ai FLUX schnell | ~$0.003/img |
| 7 | Synthesize Voice | edge-tts | free |
| 8 | Generate Subtitles | faster-whisper (local) | free |
| 9 | Render Video | Remotion → Chromium → MP4 | free |

Typical total cost: **~$0.015–$0.030** per video (4 images).

## Celery Task

`backend/workers/remotion_generate.py` → task name `remotion.generate_video`

## Remotion Service API

```http
POST http://localhost:3001/render
Content-Type: application/json
```

```json
{
  "template": "tech-dark",
  "resolution": "shorts",
  "script": "...",
  "subtitles": [{ "word": "Hello", "start": 0.0, "end": 0.4 }],
  "audio_path": "/abs/path/to/tts.mp3",
  "images": ["/abs/path/to/img1.png", "/abs/path/to/img2.png"],
  "code_snippets": [{ "language": "python", "code": "print('hello')", "caption": "Example" }],
  "music_track": "lofi.mp3",
  "music_volume": 0.15,
  "language": "en",
  "output_path": "/abs/path/to/output.mp4",
  "fps": 30
}
```

Response: `{ "success": true, "output_path": "..." }`

## Templates

| Template | Key Components | Best For |
|---|---|---|
| `tech-dark` | Dark gradient + `CodeTerminal` + Ken Burns image transitions | Programming tutorials |
| `minimal` | Full-bleed images + vignette overlay | Clean explainers |
| `bold` | `TitleCard` intro + flash cuts + accent bar | High-energy content |
| `reel` | Animated gradient + `SubtitleWord` pulse highlight | Short-form reels |

## Resolutions

| Key | Dimensions | Platform |
|---|---|---|
| `shorts` | 1080 × 1920 | YouTube Shorts, TikTok, Reels |
| `landscape` | 1920 × 1080 | YouTube standard |
| `square` | 1080 × 1080 | Instagram |

## Remotion Components

```
remotion-service/src/components/
  GradientBackground.tsx   Animated gradient backgrounds
  SubtitleWord.tsx          Per-word TikTok-style subtitles with pulse
  ImageScene.tsx            Ken Burns pan/zoom effect on images
  CodeBlock.tsx             Syntax-highlighted code block
  TitleCard.tsx             Animated intro card
  CodeTerminal.tsx          Terminal-style code animation
  SplitScreen.tsx           Side-by-side layout
```

## Adding a New Template

1. Create `remotion-service/src/compositions/MyTemplate.tsx`
2. Register in `remotion-service/src/compositions/index.ts`
3. Add to `template` union type in `remotion-service/src/types.ts`
4. **Restart remotion-service** — bundle must rebuild

## Real-time Progress

Each step emits WebSocket events on channel `job:{job_id}`.
Frontend component: `frontend/src/components/PipelineView.tsx`
Hook: `frontend/src/hooks/useJobStream.ts`
