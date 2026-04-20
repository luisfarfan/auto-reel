# 🖨️ MoneyPrinter V2 — Enhanced Edition

<div align="center">

![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/badge/License-AGPL%20v3-blue?style=for-the-badge)

**AI-powered content creation platform. Generate tech videos, YouTube Shorts, and Twitter posts — fully self-hosted, no paid LLM APIs required.**

[Features](#-whats-new) · [Architecture](#-architecture) · [Setup](#-setup) · [Configuration](#-configuration) · [Roadmap](#-roadmap)

</div>

---

> 🙏 Built on top of the excellent [MoneyPrinterV2](https://github.com/FujiwaraChoki/MoneyPrinterV2) by [@FujiwaraChoki](https://github.com/FujiwaraChoki). The original project provided the complete automation foundation — YouTube Shorts generation, Twitter posting, affiliate marketing, and local business outreach. Without that base, none of this would have been possible. Go give it a ⭐.

---

## 🆕 What's New

This fork keeps everything from the original CLI and adds a full web platform on top:

| Layer | What was added |
|---|---|
| 🎨 **React Dashboard** | Visual job management, real-time pipeline view, video player |
| ⚙️ **FastAPI Backend** | REST API + WebSocket, PostgreSQL, Celery job queue |
| 🎬 **Remotion Renderer** | Node.js microservice that renders animated MP4s with React |
| 🤖 **Tech Video Pipeline** | 9-step AI pipeline: search → script → images → TTS → subtitles → render |
| 📹 **YouTube Shorts Pipeline** | 10-step pipeline with web search, duration control, topic override, and auto-upload |
| 🔗 **Account Connect Flow** | One-click Firefox session capture — log in once, all uploads automated |
| 💰 **Cost Tracking** | Per-service cost breakdown (fal.ai, Ollama, edge-tts, Whisper) |

---

## 🎬 Tech Video Pipeline

The flagship new feature. Triggered from the dashboard, the full pipeline runs automatically:

```
🔍 Web Search          →  Tavily API (optional — fetch current docs/news)
📝 Generate Script     →  Ollama (Qwen2.5-Coder recommended)
🏷️  Generate Metadata  →  YouTube title + description
💻 Code Snippets       →  2–3 real examples (tech-dark template)
🖼️  Image Prompts      →  LLM-generated prompts
🎨 Generate Images     →  fal.ai FLUX (~$0.003/image)
🔊 Synthesize Voice    →  edge-tts (7 languages, Microsoft Neural)
📋 Word Subtitles      →  faster-whisper (TikTok-style, per-word timing)
🎥 Render Video        →  Remotion 4 + Chromium → MP4
```

Each step streams real-time progress to the dashboard via WebSocket.

### Templates

| Template | Style | Best for |
|---|---|---|
| `tech-dark` | Dark gradient + animated code blocks + Ken Burns images | Programming tutorials |
| `minimal` | Full-bleed images + vignette overlay | Clean explainers |
| `bold` | Title card intro + flash cuts + accent bar | High-energy content |
| `reel` | Animated gradient backgrounds + pulse highlight | Short-form reels |

### Resolutions

| Key | Size | Platform |
|---|---|---|
| `shorts` | 1080 × 1920 | YouTube Shorts · TikTok · Reels |
| `landscape` | 1920 × 1080 | YouTube standard |
| `square` | 1080 × 1080 | Instagram |

---

## 📹 YouTube Shorts Pipeline

> ✅ **Fully working end-to-end** — tested on Ubuntu 24.04 with dual-GPU (NVIDIA + AMD). See [Troubleshooting](docs/Troubleshooting.md) if Firefox doesn't open.

Generate, compose, and upload in one click:

```
🔍 Web Search          →  Tavily API (optional — improves script accuracy)
💡 Generate Topic      →  Ollama LLM (skipped if topic provided manually)
📝 Generate Script     →  Ollama LLM (~75–300 words depending on duration)
🏷️  Generate Metadata  →  YouTube title + description
🖼️  Image Prompts      →  LLM-generated prompts (3–6 images)
🎨 Generate Images     →  fal.ai FLUX schnell (~$0.003/image)
🔊 Synthesize Voice    →  edge-tts (7 languages, Microsoft Neural)
📋 Generate Subtitles  →  faster-whisper base (word-level SRT)
🎞️  Compose Video      →  MoviePy — images + TTS + background music + subtitles
📤 Upload to YouTube   →  Selenium Firefox — auto or manual re-upload from dashboard
```

| Option | Values | Default |
|---|---|---|
| Duration | `30s` · `60s` · `90s` · `120s` | `60s` |
| Language | English, Spanish, Portuguese, French, German, Italian, Japanese | English |
| Topic | Free text (skips topic generation step) | — |
| Web search | on / off | off |
| Auto-upload | on / off | off |

If auto-upload is off (or the upload step fails), a **"Upload to YouTube"** button appears on the job card — click it to upload the already-rendered video without regenerating anything.

### Account Connect Flow

No credentials stored. Session captured once from a plain (non-automated) Firefox:

1. Create an account in the dashboard (YouTube or Twitter)
2. Click **Connect** → plain Firefox opens to the platform login page
3. Log in normally — Google/YouTube does **not** block this (no WebDriver involved)
4. Dashboard reads the session cookie from the Firefox profile and saves the path
5. All future jobs reuse that profile — fully automated

Real-time status streams back via WebSocket: `opening → waiting → detected → connected`.

---

## 🏗️ Architecture

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
│  • youtube      │    │  Express · Webpack bundle    │
│  • twitter      │    │  4 templates · 3 resolutions │
│  • remotion     │    │  Renders MP4 via Chromium    │
└─────────────────┘    └─────────────────────────────┘
         │
┌────────▼────────────────────────────────────────────┐
│                  Local Services                     │
│  🦙 Ollama  ·  🐘 PostgreSQL  ·  🔴 Redis           │
│  🎨 fal.ai  ·  🔊 edge-tts  ·  👂 faster-whisper   │
└─────────────────────────────────────────────────────┘
```

---

## 🧰 Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, shadcn/ui |
| **Backend** | FastAPI, SQLAlchemy (async), PostgreSQL, Alembic |
| **Task Queue** | Celery + Redis |
| **Real-time** | Redis Pub/Sub → WebSocket |
| **LLM** | Ollama — Qwen2.5-Coder, Llama3, Mistral, etc. |
| **Image Gen** | fal.ai (FLUX) |
| **TTS** | edge-tts (Microsoft Neural voices, 7 languages) |
| **STT** | faster-whisper (word-level timestamps) |
| **Video Render** | Remotion 4 — React → MP4 via headless Chromium |
| **Web Search** | Tavily API (optional) |
| **Browser Automation** | Selenium + pre-authenticated Firefox profiles |

> 💡 The only paid external services are **fal.ai** (~$0.003/image) and **Tavily** (free tier available). Everything else runs locally.

---

## 📋 Requirements

- 🐍 **Python 3.12**
- 🟢 **Node.js 18+**
- 🐘 **PostgreSQL**
- 🔴 **Redis**
- 🦙 **[Ollama](https://ollama.ai)** with at least one model pulled
- 🐹 **Go** — only needed for Local Business Outreach

---

## 🚀 Setup

### 1. Clone

```bash
git clone https://github.com/luisfarfan/MoneyPrinterV2.git
cd MoneyPrinterV2
```

### 2. Python environment

```bash
cp config.example.json config.json   # then fill in your values
python -m venv venv
source venv/bin/activate             # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Remotion microservice

```bash
cd remotion-service
npm install
cd ..
```

### 4. React dashboard

```bash
cd frontend
npm install
cd ..
```

### 5. Environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql+asyncpg://mpv2:mpv2@localhost:5432/mpv2
REDIS_URL=redis://localhost:6379/0
FAL_KEY=your_fal_api_key
TAVILY_API_KEY=your_tavily_api_key   # optional
```

### 6. Database

```bash
alembic upgrade head
```

### 7. Pull an LLM model

```bash
ollama pull qwen2.5-coder
```

---

## ▶️ Running

Open **4 terminals** from the project root:

```bash
# Terminal 1 — FastAPI backend
uvicorn backend.main:app --host 0.0.0.0 --port 8001

# Terminal 2 — Celery worker
celery -A backend.workers.celery_app worker --loglevel=info -Q remotion,youtube,twitter -c 1

# Terminal 3 — Remotion renderer
cd remotion-service && npx tsx src/server.ts

# Terminal 4 — React dashboard
cd frontend && npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** 🎉

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

## ⚙️ Configuration

### `config.json` (Python CLI)

| Key | Description |
|---|---|
| `ollama_model` | LLM model name (e.g. `qwen2.5-coder:latest`) |
| `imagemagick_path` | Required for MoviePy subtitle rendering |
| `firefox_profile` | Path to pre-authenticated Firefox profile |

### `.env` (Backend + Remotion)

| Key | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `FAL_KEY` | fal.ai API key — image generation |
| `TAVILY_API_KEY` | Tavily API key — web search (optional) |

---

## 🗺️ Roadmap

### ✅ Done

- [x] Web search integration for YouTube Shorts pipeline (Tavily)
- [x] Duration selector per job (30s / 60s / 90s / 120s)
- [x] Topic override (skip LLM topic generation)
- [x] Account connect flow — plain Firefox session capture (no WebDriver, Google won't block)
- [x] Auto-upload YouTube Shorts via Selenium after generation
- [x] Manual re-upload button for failed/skipped upload steps
- [x] Real-time pipeline progress via WebSocket
- [x] Cost tracking per service and per job
- [x] Firefox dual-GPU fix for Ubuntu 24.04 (NVIDIA + AMD)
- [x] Twitter auto-post from dashboard — generate tweet (Ollama) + post via Selenium in one click

### 🚧 Next Up

- [ ] 🎵 **TikTok** — connect account + auto-upload Shorts (same Selenium flow as YouTube)
- [ ] 📤 **Auto-upload Remotion tech videos** to YouTube from dashboard

### 📅 Planned

- [ ] 📤 Auto-upload Remotion tech videos to YouTube
- [ ] ⏰ CRON scheduling for automated posting
- [ ] 🖼️ Video thumbnail previews in job list
- [ ] 💸 Cost budget alerts and per-account limits
- [ ] 🐳 Full Docker Compose setup (one command for everything)
- [ ] 📱 Mobile-responsive dashboard
- [ ] 🔑 Support OpenAI / Anthropic as LLM providers alongside Ollama
- [ ] 🖥️ Virtual display (Xvfb) for headless server deployments

---

## 📁 Project Structure

```
MoneyPrinterV2/
├── src/                        # Original Python CLI (unchanged)
│   ├── main.py                 # Interactive menu
│   ├── cron.py                 # Headless scheduler runner
│   └── classes/                # YouTube, Twitter, AFM, Outreach, TTS
│
├── backend/                    # FastAPI backend ✨
│   ├── models/                 # SQLAlchemy ORM (Job, Video, Account, Cost)
│   ├── routes/                 # REST API routers
│   ├── schemas/                # Pydantic request/response schemas
│   ├── workers/                # Celery tasks (youtube, twitter, remotion)
│   └── settings.py
│
├── remotion-service/           # Node.js video renderer ✨
│   └── src/
│       ├── server.ts           # Express API (/render, /health, /media)
│       ├── renderer.ts         # Remotion bundle + renderMedia logic
│       ├── types.ts            # Zod schemas + shared types
│       ├── compositions/       # TechDark, Minimal, Bold, Reel
│       └── components/         # GradientBackground, SubtitleWord, ImageScene…
│
├── frontend/                   # React dashboard ✨
│   └── src/
│       ├── pages/              # Dashboard, YouTube, Twitter, TechVideo, Costs, Config
│       ├── components/         # VideoPreview, PipelineView, AccountRow
│       ├── hooks/              # useJobStream (WebSocket)
│       └── lib/                # api.ts — typed fetch client
│
├── docs/
├── scripts/
├── config.example.json
└── .env.example
```

---

## 🛠️ Troubleshooting

Common issues and fixes are documented in **[docs/Troubleshooting.md](docs/Troubleshooting.md)**.

| Issue | Quick link |
|---|---|
| Firefox won't open / `Process unexpectedly closed with status 0` | [Firefox crash on Ubuntu 24.04 dual-GPU](docs/Troubleshooting.md#firefox-wont-open--process-unexpectedly-closed-with-status-0) |
| Firefox profile path not found | [Profile path error](docs/Troubleshooting.md#firefox-profile-path-not-found) |

---

## 🙏 Acknowledgments

| Project | Why |
|---|---|
| [MoneyPrinterV2](https://github.com/FujiwaraChoki/MoneyPrinterV2) by @FujiwaraChoki | The entire original automation foundation this fork is built on |
| [Remotion](https://remotion.dev) | React-based video rendering engine |
| [Ollama](https://ollama.ai) | Local LLM inference |
| [fal.ai](https://fal.ai) | Fast image generation API |
| [edge-tts](https://github.com/rany2/edge-tts) | Microsoft Neural TTS voices |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | Word-level speech transcription |

---

## 📄 License

Licensed under the **GNU Affero General Public License v3.0** — same as the original project. See [LICENSE](LICENSE) for details.

## ⚠️ Disclaimer

For educational purposes only. All automation must comply with the terms of service of the platforms being accessed. The authors are not responsible for any misuse.
