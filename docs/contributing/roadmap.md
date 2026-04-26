# Roadmap

## Current Status

| Component | Status |
|---|---|
| LLM (Ollama) | ✅ working |
| TTS (edge-tts) | ✅ working |
| STT / subtitles (faster-whisper, word-level) | ✅ working |
| Image gen (fal.ai FLUX) | ✅ working |
| YouTube Shorts compose (MoviePy) | ✅ working |
| YouTube upload (Selenium) | ✅ working |
| Twitter post (Selenium, via Celery) | ✅ working |
| React dashboard (FastAPI + WebSocket) | ✅ working |
| PostgreSQL + SQLAlchemy async + Alembic | ✅ working |
| Celery + Redis (async jobs + WS progress) | ✅ working |
| Remotion tech video (4 templates, 3 resolutions) | ✅ working |
| Account connect flow (Firefox → session in DB) | ✅ working |
| Web search (Tavily) | ✅ working |
| Outreach (Google Maps scraper) | ❌ broken — scraper v0.9.7 outdated |
| TikTok upload | ❌ not implemented |
| Claude API / OpenAI as LLM fallback | ❌ Ollama only |
| Automated test suite | ❌ none |

## Upcoming

### STEP 9 — Twitter connect flow
Same pattern as YouTube account connect. Open Firefox, wait for login, save profile to DB.
Files: `backend/routes/accounts.py`, `backend/workers/twitter.py`, `frontend/src/pages/Twitter.tsx`

### STEP 10 — Music library
CC0 music tracks in `remotion-service/assets/music/`. Track selector in TechVideo page.

### STEP 11 — CRON scheduling from dashboard
Schedule jobs from UI. Target: Celery beat or cron-based subprocess.

### STEP 12 — Docker Compose full stack
Single `docker-compose up` starts all 5 services (PostgreSQL, Redis, FastAPI, Remotion, React).

### STEP 13 — TikTok upload
Selenium automation against TikTok Studio. Same account connect pattern.

### STEP 14 — Fix Outreach
Update Google Maps scraper to v2 binary (`google-maps-scraper-v2` already in root). Re-test email flow.

## Contributing a Feature

1. Open issue labeled `enhancement`
2. Branch from `main`
3. PR targeting `main` — one feature per PR
4. Link PR to issue; `WIP` label until ready

Implementation notes for each phase: [../../IMPROVEMENTS.md](../../IMPROVEMENTS.md)
