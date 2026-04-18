# MoneyPrinter V2 — Enhanced Edition

> Built on top of the excellent [MoneyPrinterV2](https://github.com/FujiwaraChoki/MoneyPrinterV2) by [@FujiwaraChoki](https://github.com/FujiwaraChoki). Huge thanks for laying the foundation — the original automation workflows, Selenium integrations, and overall concept made this extension possible.

This fork takes the original CLI tool and adds a full web platform on top of it: a React dashboard, a FastAPI backend with job queuing, real-time pipeline tracking, and a brand new AI-powered tech video renderer built with Remotion.

---

## What Was Here Originally

The original MoneyPrinterV2 provides a Python CLI that automates four workflows:

- **YouTube Shorts** — script → TTS → images → MoviePy video → Selenium upload
- **Twitter Bot** — LLM-generated tweets posted via Selenium
- **Affiliate Marketing** — Amazon scraping + LLM pitch + Twitter post
- **Local Business Outreach** — Google Maps scraping + email cold outreach

All of that still works and lives in `src/`.

---

## What We Built On Top

### Web Dashboard

A full React + Vite + Tailwind dashboard to manage everything visually — no more CLI.

- **Dashboard** — live job feed, cost summary, recent activity
- **YouTube** — submit and monitor Shorts generation jobs
- **Twitter** — manage posting jobs per account
- **Tech Videos** — new AI video pipeline (see below)
- **Costs** — per-service cost tracking (fal.ai, Ollama, edge-tts, Whisper)
- **Config** — edit `config.json` from the browser

Real-time pipeline events streamed via WebSocket — watch each step run live with progress %, status badges, and step detail.

### FastAPI Backend

Replaces the need to run the CLI manually. Exposes a REST API + WebSocket for the dashboard.

- Job queue via **Celery + Redis**
- **PostgreSQL** for persistent job, video, account, and cost records
- Redis Pub/Sub → WebSocket for real-time step events
- Typed Pydantic schemas throughout

### Remotion Video Renderer (new)

A Node.js microservice that renders fully animated MP4 videos using **Remotion 4** (React → headless Chromium → video).

The full pipeline, triggered from the dashboard:

```
Web Search (Tavily, optional)        — fetch current docs/news about the topic
    → Generate Script                — Ollama (Qwen2.5-Coder recommended)
    → Generate Metadata              — YouTube title + description
    → Generate Code Snippets         — 2–3 real code examples (tech-dark only)
    → Generate Image Prompts
    → Generate Images                — fal.ai FLUX
    → Synthesize Voice               — edge-tts (7 languages, Microsoft Neural)
    → Word-level Subtitles           — faster-whisper (TikTok-style, per-word timing)
    → Render Video                   — Remotion 4 + Chromium → MP4
```

#### Templates

| Template | Style |
|---|---|
| `tech-dark` | Dark gradient, animated code blocks with line-by-line reveal, Ken Burns images |
| `minimal` | Full-bleed images, vignette overlay, clean subtitles |
| `bold` | Title card intro, flash cuts on scene change, accent color bar |
| `reel` | Animated gradient backgrounds, pulse highlight behind subtitles |

#### Resolutions

| | Size | For |
|---|---|---|
| `shorts` | 1080 × 1920 | YouTube Shorts, TikTok, Reels |
| `landscape` | 1920 × 1080 | YouTube standard |
| `square` | 1080 × 1080 | Instagram |

#### Remotion Components

- `GradientBackground` — animated angle sweep across video duration
- `SubtitleWord` — sliding 3-word window, spring scale on active word
- `ImageScene` — Ken Burns effect with alternating pan direction
- `CodeBlock` — syntax highlighted, line-by-line entrance animation
- `TitleCard` — slide-up spring, first-word accent color, fade out
- `CodeTerminal` — terminal window UI with char-by-char typing effect
- `SplitScreen` — 50/50 animated gradient divider

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   React Dashboard                   │  :5173
│  Dashboard · YouTube · Twitter · Tech Videos        │
│  Costs · Config · Real-time pipeline via WebSocket  │
└────────────────────┬────────────────────────────────┘
                     │ HTTP / WebSocket
┌────────────────────▼────────────────────────────────┐
│              FastAPI Backend                        │  :8001
│  Jobs · Videos · Accounts · Costs · Config · WS    │
│  PostgreSQL + Redis Pub/Sub                         │
└──────┬──────────────────────────┬───────────────────┘
       │ Celery tasks             │ HTTP POST
┌──────▼──────────┐    ┌──────────▼──────────────────┐
│  Celery Workers │    │  Remotion Service (Node.js)  │  :3001
│  youtube        │    │  Express · Webpack bundle    │
│  twitter        │    │  4 templates · 3 resolutions │
│  remotion       │    │  Renders MP4 via Chromium    │
└─────────────────┘    └─────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────┐
│                  Local Services                     │
│  Ollama (LLM) · PostgreSQL · Redis · fal.ai (imgs)  │
│  edge-tts (TTS) · faster-whisper (STT) · Tavily     │
└─────────────────────────────────────────────────────┘
```

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, SQLAlchemy (async), PostgreSQL, Alembic |
| Task Queue | Celery + Redis |
| Real-time | Redis Pub/Sub → WebSocket |
| LLM | Ollama (Qwen2.5-Coder, Llama3, Mistral, etc.) |
| Image Gen | fal.ai (FLUX) |
| TTS | edge-tts (Microsoft Neural voices, 7 languages) |
| STT | faster-whisper (word-level timestamps) |
| Video Render | Remotion 4 — React → MP4 via headless Chromium |
| Web Search | Tavily API (optional) |
| Browser Automation | Selenium + pre-authenticated Firefox profiles |

Everything runs locally. The only paid external services are fal.ai (image generation, ~$0.003/image) and Tavily (web search, has a free tier).

---

## Requirements

- Python 3.12
- Node.js 18+
- PostgreSQL
- Redis
- [Ollama](https://ollama.ai) with at least one model pulled (`ollama pull qwen2.5-coder`)
- Go — only for Local Business Outreach

---

## Setup

```bash
git clone https://github.com/luisfarfan/MoneyPrinterV2.git
cd MoneyPrinterV2

# Python environment
cp config.example.json config.json   # fill in values
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Remotion microservice
cd remotion-service && npm install && cd ..

# React dashboard
cd frontend && npm install && cd ..

# Environment variables
cp .env.example .env   # fill in DATABASE_URL, REDIS_URL, FAL_KEY, TAVILY_API_KEY
```

### Database migrations

```bash
alembic upgrade head
```

### Run (local dev — 4 terminals)

```bash
# 1 — FastAPI
uvicorn backend.main:app --host 0.0.0.0 --port 8001

# 2 — Celery worker
celery -A backend.workers.celery_app worker --loglevel=info -Q remotion,youtube,twitter -c 1

# 3 — Remotion renderer
cd remotion-service && npx tsx src/server.ts

# 4 — React dashboard
cd frontend && npm run dev
```

Open `http://localhost:5173`.

### macOS quick setup

```bash
bash scripts/setup_local.sh
python scripts/preflight_local.py
```

---

## Configuration

| Key | Where | Description |
|---|---|---|
| `ollama_model` | `config.json` | LLM model to use (`qwen2.5-coder:latest` recommended) |
| `fal_key` / `FAL_KEY` | `.env` | fal.ai API key for image generation |
| `tavily_api_key` | `.env` | Tavily web search (optional, improves script accuracy) |
| `imagemagick_path` | `config.json` | Required for MoviePy subtitle rendering (YouTube pipeline) |
| `firefox_profile` | `config.json` | Pre-authenticated Firefox profile for Selenium |
| `DATABASE_URL` | `.env` | PostgreSQL connection string |
| `REDIS_URL` | `.env` | Redis connection string |

---

## Roadmap

### In Progress

- [ ] Web search for YouTube Shorts pipeline (same Tavily integration as tech videos)
- [ ] Duration selector per job (30s / 60s / 90s / 120s) in YouTube pipeline

### Planned

- [ ] Music track library — royalty-free background music for Remotion templates
- [ ] Auto-upload Remotion videos to YouTube
- [ ] Twitter video posting (currently text only)
- [ ] CRON scheduling for tech video jobs
- [ ] Video thumbnail preview in job list
- [ ] Cost budget alerts and limits per account
- [ ] Full Docker Compose setup (one command to start everything)
- [ ] Mobile-responsive dashboard
- [ ] Support OpenAI / Anthropic as LLM providers alongside Ollama

---

## Project Structure

```
MoneyPrinterV2/
├── src/                        # Original Python CLI (unchanged)
│   ├── main.py
│   ├── cron.py
│   └── classes/                # YouTube, Twitter, AFM, Outreach, TTS
├── backend/                    # FastAPI backend (new)
│   ├── models/                 # SQLAlchemy ORM (Job, Video, Account, Cost)
│   ├── routes/                 # REST API routers
│   ├── schemas/                # Pydantic schemas
│   ├── workers/                # Celery tasks (youtube, twitter, remotion)
│   └── settings.py
├── remotion-service/           # Node.js video renderer (new)
│   └── src/
│       ├── server.ts           # Express API (/render, /health, /media)
│       ├── renderer.ts         # Remotion bundle + renderMedia
│       ├── types.ts            # Zod schemas
│       ├── compositions/       # TechDark, Minimal, Bold, Reel
│       └── components/         # GradientBackground, SubtitleWord, ImageScene, ...
├── frontend/                   # React dashboard (new)
│   └── src/
│       ├── pages/              # Dashboard, YouTube, Twitter, TechVideo, Costs, Config
│       ├── components/         # VideoPreview, PipelineView
│       ├── hooks/              # useJobStream (WebSocket)
│       └── lib/                # api.ts — typed fetch client
├── docs/
├── scripts/
├── config.example.json
└── .env.example
```

---

## Acknowledgments

This project is built on top of [MoneyPrinterV2](https://github.com/FujiwaraChoki/MoneyPrinterV2) by [@FujiwaraChoki](https://github.com/FujiwaraChoki). The original project provided the complete automation foundation — YouTube Shorts generation, Twitter posting, affiliate marketing, and local business outreach. Without that base, none of this would have been possible. Go give it a star.

---

## License

Licensed under the `Affero General Public License v3.0`. See [LICENSE](LICENSE) for details.

## Disclaimer

For educational purposes only. All automation must comply with the terms of service of the platforms being accessed. The authors are not responsible for any misuse.
