# MoneyPrinterV2 — Documentation Index

> Master index. All docs live here or link from here.

---

## AI Editor Entry Points

> These files are auto-loaded by each editor. They are thin wrappers — read them first, then follow links here for depth.

| File | Editor | Purpose |
|---|---|---|
| [/CLAUDE.md](../CLAUDE.md) | Claude Code | Critical rules + orientation + links |
| [/AGENTS.md](../AGENTS.md) | Codex / Copilot / generic agents | Same, different format |
| [/.cursorrules](../.cursorrules) | Cursor | Rules + key files table + commands |
| [/backend/CLAUDE.md](../backend/CLAUDE.md) | Claude Code (in backend/) | Backend-specific: routes, workers, DB |
| [/frontend/CLAUDE.md](../frontend/CLAUDE.md) | Claude Code (in frontend/) | React, hooks, API client |
| [/remotion-service/CLAUDE.md](../remotion-service/CLAUDE.md) | Claude Code (in remotion-service/) | Bundle cache, templates, render API |
| [/src/CLAUDE.md](../src/CLAUDE.md) | Claude Code (in src/) | "Don't touch", import quirk, key files |

---

## Architecture

| Doc | Covers |
|---|---|
| [architecture/overview.md](architecture/overview.md) | Stack, layers, ports, pipelines, design principles |
| [architecture/database.md](architecture/database.md) | Full PostgreSQL schema (accounts, jobs, steps, videos, costs) |
| [architecture/websocket.md](architecture/websocket.md) | WebSocket channels, event formats, Redis Pub/Sub pattern |
| [architecture/celery.md](architecture/celery.md) | Queues, task_routes, required step pattern, how to add a task |
| [architecture/legacy-cli.md](architecture/legacy-cli.md) | src/ explained — import path quirk, key modules, when to modify |

---

## Guides

| Doc | Covers |
|---|---|
| [guides/setup.md](guides/setup.md) | Prerequisites, first-time setup, account connect |
| [guides/running.md](guides/running.md) | How to start each layer, Docker Compose, DB migrations |
| [guides/configuration.md](Configuration.md) | config.json keys + .env reference |
| [guides/troubleshooting.md](guides/troubleshooting.md) | Firefox/Selenium, Remotion, Celery, ImageMagick issues |

---

## Features

| Doc | Covers |
|---|---|
| [features/tech-video.md](features/tech-video.md) | Remotion pipeline, templates, render API, adding templates |
| [features/youtube-shorts.md](features/youtube-shorts.md) | MoviePy pipeline, upload flow, account connect |
| [features/twitter.md](features/twitter.md) | Tweet automation, Selenium selectors, account connect |
| [features/post-bridge.md](features/post-bridge.md) | TikTok/Instagram cross-posting via Post Bridge API |
| [AffiliateMarketing.md](AffiliateMarketing.md) | Amazon scraping + LLM pitch generation |
| [PostBridge.md](PostBridge.md) | Post Bridge setup details |

---

## Contributing

| Doc | Covers |
|---|---|
| [contributing/conventions.md](contributing/conventions.md) | Python + TypeScript style, comments policy, error handling |
| [contributing/roadmap.md](contributing/roadmap.md) | Current status + upcoming steps |
| [/IMPROVEMENTS.md](../IMPROVEMENTS.md) | Detailed improvement plan with implementation notes |
| [/CONTRIBUTING.md](../CONTRIBUTING.md) | PR process, issue labels, code of conduct |

---

## Quick Reference

### Services

| Service | Port | Start Command |
|---|---|---|
| FastAPI backend | 8000 | `uvicorn backend.main:app --reload` |
| React frontend | 5173 | `cd frontend && npm run dev` |
| Remotion service | 3001 | `cd remotion-service && npm run dev` |
| PostgreSQL | 5432 | `docker-compose up postgres -d` |
| Redis | 6379 | `docker-compose up redis -d` |
| Ollama | 11434 | `ollama serve` |

### Cost Reference

| Service | Cost |
|---|---|
| fal.ai FLUX schnell | ~$0.003/image |
| edge-tts | free |
| faster-whisper | free (local) |
| Ollama | free (local) |
| Tavily API | ~$0.001/search (optional) |

### Remotion Templates + Resolutions

Templates: `tech-dark` · `minimal` · `bold` · `reel`

Resolutions: `shorts` (1080×1920) · `landscape` (1920×1080) · `square` (1080×1080)
