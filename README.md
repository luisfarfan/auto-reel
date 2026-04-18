# MoneyPrinter V2

An automated content creation and publishing platform. Generate tech videos, YouTube Shorts, and Twitter posts using local AI — fully self-hosted, no paid LLM APIs required.

---

## What's Inside

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                   React Dashboard                   │  :5173
│  Dashboard · YouTube · Twitter · Tech Videos        │
│  Costs · Config · Real-time pipeline via WebSocket  │
└────────────────────┬────────────────────────────────┘
                     │ HTTP
┌────────────────────▼────────────────────────────────┐
│              FastAPI Backend                        │  :8001
│  Jobs · Videos · Accounts · Costs · Config · WS    │
│  PostgreSQL + Redis Pub/Sub                         │
└──────┬──────────────────────────┬───────────────────┘
       │ Celery tasks             │ HTTP POST
┌──────▼──────────┐    ┌──────────▼──────────────────┐
│  Celery Workers │    │   Remotion Service (Node.js) │  :3001
│  youtube        │    │   Webpack bundle · 4 templates│
│  twitter        │    │   Renders MP4 via Chromium   │
│  remotion       │    └─────────────────────────────┘
└─────────────────┘
       │
┌──────▼──────────────────────────────────────────────┐
│                  Local Services                     │
│  Ollama (LLM) · PostgreSQL · Redis · fal.ai (imgs) │
│  edge-tts (TTS) · faster-whisper (STT) · Tavily    │
└─────────────────────────────────────────────────────┘
```

### Tech Video Pipeline (Remotion)

Full automated pipeline triggered from the dashboard:

```
Web Search (Tavily, optional)
    → Generate Script        (Ollama / Qwen2.5-Coder)
    → Generate Metadata      (title + description)
    → Generate Code Snippets (for tech-dark template)
    → Generate Image Prompts
    → Generate Images        (fal.ai FLUX)
    → Synthesize Audio       (edge-tts, 7 languages)
    → Word-level Subtitles   (faster-whisper)
    → Render Video           (Remotion 4 + Chromium)
```

Real-time progress streamed to the dashboard via WebSocket. Video player embedded in job row on completion.

#### Remotion Templates

| Template | Style |
|---|---|
| `tech-dark` | Dark gradient + code blocks + Ken Burns images |
| `minimal` | Full-bleed images + vignette overlay |
| `bold` | Title card intro + flash cuts + accent bar |
| `reel` | Animated gradient scenes + pulse highlight |

#### Resolutions

| Key | Size | Use case |
|---|---|---|
| `shorts` | 1080×1920 | YouTube Shorts / TikTok / Reels |
| `landscape` | 1920×1080 | YouTube standard |
| `square` | 1080×1080 | Instagram |

### YouTube Shorts Pipeline

```
Topic → Script (Ollama) → Metadata → Images (fal.ai)
    → TTS (edge-tts) → Subtitles (Whisper)
    → Video (MoviePy) → Upload (Selenium)
```

### Twitter Bot

Automated tweet generation and posting via Selenium. Supports CRON scheduling.

### Affiliate Marketing

Amazon product scraping + LLM pitch generation + Twitter posting.

### Local Business Outreach

Google Maps scraping (Go binary) + email extraction + cold outreach via SMTP.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, SQLAlchemy (async), PostgreSQL, Alembic |
| Task Queue | Celery + Redis |
| Real-time | Redis Pub/Sub → WebSocket |
| LLM | Ollama (Qwen2.5-Coder, Llama3, etc.) |
| Image Gen | fal.ai (FLUX) |
| TTS | edge-tts (Microsoft Neural voices, 7 languages) |
| STT | faster-whisper (word-level timestamps) |
| Video | Remotion 4 (React → MP4 via headless Chromium) |
| Web Search | Tavily API |
| Browser Automation | Selenium + Firefox profiles |

---

## Requirements

- Python 3.12
- Node.js 18+
- PostgreSQL
- Redis
- [Ollama](https://ollama.ai) with at least one model pulled
- Go (only for Local Business Outreach)

---

## Setup

```bash
git clone https://github.com/FujiwaraChoki/MoneyPrinterV2.git
cd MoneyPrinterV2

# Python backend
cp config.example.json config.json   # fill in values
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Remotion microservice
cd remotion-service
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..

# Copy and configure environment
cp .env.example .env   # fill in POSTGRES_URL, REDIS_URL, FAL_KEY, TAVILY_API_KEY
```

### Database

```bash
cd backend
alembic upgrade head
```

### Running (local dev)

```bash
# Terminal 1 — Backend API
uvicorn backend.main:app --host 0.0.0.0 --port 8001

# Terminal 2 — Celery worker
celery -A backend.workers.celery_app worker --loglevel=info -Q remotion,youtube,twitter -c 1

# Terminal 3 — Remotion service
cd remotion-service && npx tsx src/server.ts

# Terminal 4 — Frontend
cd frontend && npm run dev
```

Open `http://localhost:5173`.

### macOS quick setup

```bash
bash scripts/setup_local.sh
python scripts/preflight_local.py
```

### Docker (partial)

```bash
docker-compose up
```

---

## Configuration

All configuration lives in `config.json` (copy from `config.example.json`) and `.env`.

Key values:

| Key | Description |
|---|---|
| `ollama_model` | Model to use (e.g. `qwen2.5-coder:latest`) |
| `fal_key` | fal.ai API key for image generation |
| `tavily_api_key` | Tavily API key for web search |
| `imagemagick_path` | Required for MoviePy subtitle rendering |
| `firefox_profile` | Pre-authenticated Firefox profile path |

---

## Roadmap

### In Progress

- [ ] Web search integration for YouTube Shorts pipeline (same as tech videos)
- [ ] Duration control per job (30s / 60s / 90s / 120s)

### Planned

- [ ] Music track library — download royalty-free tracks from Pixabay and place in `remotion-service/assets/music/`
- [ ] YouTube auto-upload from Remotion-generated videos
- [ ] Twitter video posting (not just text)
- [ ] Schedule tech video jobs via CRON
- [ ] Multi-account support per platform in the dashboard
- [ ] Video preview thumbnails in job list
- [ ] Export/download button in video player
- [ ] Cost budget alerts and per-account cost tracking
- [ ] Support for additional LLM providers (OpenAI, Anthropic) alongside Ollama
- [ ] Docker Compose full-stack setup (all services in one command)
- [ ] Mobile-responsive dashboard

---

## Project Structure

```
MoneyPrinterV2/
├── src/                        # Legacy Python CLI (original MPV2)
│   ├── main.py                 # Interactive menu
│   ├── cron.py                 # Headless scheduler runner
│   └── classes/                # YouTube, Twitter, AFM, Outreach, TTS
├── backend/                    # FastAPI backend
│   ├── main.py
│   ├── models/                 # SQLAlchemy ORM models
│   ├── routes/                 # API routers
│   ├── schemas/                # Pydantic request/response schemas
│   ├── workers/                # Celery tasks
│   └── settings.py
├── remotion-service/           # Node.js video renderer
│   ├── src/
│   │   ├── server.ts           # Express API
│   │   ├── renderer.ts         # Remotion bundle + render logic
│   │   ├── types.ts            # Zod schemas + shared types
│   │   ├── compositions/       # TechDark, Minimal, Bold, Reel
│   │   └── components/         # GradientBackground, SubtitleWord, ImageScene, ...
│   └── package.json
├── frontend/                   # React dashboard
│   └── src/
│       ├── pages/              # Dashboard, YouTube, Twitter, TechVideo, Costs, Config
│       ├── components/         # VideoPreview, PipelineView, ...
│       ├── hooks/              # useJobStream (WebSocket)
│       └── lib/                # api.ts (typed fetch client)
├── docs/                       # Documentation
├── scripts/                    # Setup and utility scripts
├── config.example.json
└── .env.example
```

---

## License

MoneyPrinterV2 is licensed under the `Affero General Public License v3.0`. See [LICENSE](LICENSE) for details.

## Disclaimer

This project is for educational purposes only. The author is not responsible for any misuse. All automation should comply with the terms of service of the platforms being accessed.
