# Architecture Overview

## What It Is

Local-first AI content automation platform. Self-hosted, single user, no cloud auth.

## Four Layers

```
┌─────────────────────────────────────────────────┐
│  frontend/          React 18 SPA (port 5173)    │
├─────────────────────────────────────────────────┤
│  backend/           FastAPI + Celery (port 8000) │
├──────────────┬──────────────────────────────────┤
│  remotion-   │  src/                            │
│  service/    │  Legacy CLI (imported by workers) │
│  (port 3001) │                                  │
└──────────────┴──────────────────────────────────┘
          PostgreSQL (5432) + Redis (6379)
```

## Stack

| Layer | Technology | Version |
|---|---|---|
| Backend API | FastAPI | ≥0.111 |
| Database | PostgreSQL | ≥15 |
| ORM | SQLAlchemy | 2.0 (async) |
| Migrations | Alembic | latest |
| Job queue | Celery | ≥5.3 |
| Queue broker | Redis | ≥7 |
| Frontend | React 18 + Vite + Tailwind + shadcn/ui | — |
| Real-time | WebSocket (FastAPI) + Redis Pub/Sub | — |
| LLM | Ollama (local only) | — |
| Image gen | fal.ai FLUX schnell | ~$0.003/img |
| TTS | edge-tts (Microsoft Neural) | free |
| STT | faster-whisper (local, word-level) | free |
| Shorts video | MoviePy 1.x | — |
| Tech video | Remotion 4 (Node.js → Chromium → MP4) | — |
| Web search | Tavily API | optional |
| Browser automation | Selenium + Firefox | — |

## Design Principles

1. **Local first** — everything runs on localhost, Firefox opens on the same machine
2. **No passwords in DB** — auth is 100% Firefox profile (cookie sessions)
3. **Transparent pipelines** — every step streams real-time via WebSocket
4. **Cost tracking** — every external API call logged in `cost_records`
5. **Legacy stability** — `src/` CLI works and is imported by workers; don't refactor it

## Service Ports

| Service | Port |
|---|---|
| FastAPI backend | 8000 |
| React frontend | 5173 |
| Remotion service | 3001 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Ollama | 11434 |

## Pipelines

### Tech Video (Remotion)
```
Web Search (Tavily) → Script (Ollama) → Metadata → Code Snippets
→ Image Prompts → Images (fal.ai) → TTS (edge-tts)
→ Subtitles (faster-whisper) → Render (Remotion → Chromium → MP4)
```

### YouTube Shorts (MoviePy)
```
Topic → Script (Ollama) → Metadata → Image Prompts
→ Images (fal.ai) → TTS (edge-tts) → Subtitles (faster-whisper)
→ MoviePy compose → Selenium upload → Post Bridge (optional)
```

### Twitter Post
```
Topic + Account → Script (Ollama) → Selenium post to x.com
```

## Remotion Templates

| Template | Style |
|---|---|
| `tech-dark` | Dark gradient + animated code blocks + Ken Burns images |
| `minimal` | Full-bleed images + vignette overlay |
| `bold` | Title card intro + flash cuts + accent bar |
| `reel` | Animated gradient + pulse highlight |

Resolutions: `shorts` (1080×1920) · `landscape` (1920×1080) · `square` (1080×1080)

> **Bundle note:** Remotion Webpack bundle is built once at startup (`warmBundle()`).
> Restart `remotion-service` after modifying compositions.
