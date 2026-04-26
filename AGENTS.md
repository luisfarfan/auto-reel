# AGENTS.md

> Guidelines for AI agents (OpenAI Codex, GitHub Copilot, Cursor, etc.).
> Claude Code: see [CLAUDE.md](CLAUDE.md). Full docs: [docs/index.md](docs/index.md).

---

## Project at a Glance

MoneyPrinterV2 — local-first AI content automation. 4 layers:

- `backend/` — FastAPI ≥0.111 + Celery ≥5.3 (Python 3.12)
- `remotion-service/` — Node.js TypeScript, Remotion 4 → Chromium → MP4
- `frontend/` — React 18 + Vite + Tailwind + shadcn/ui
- `src/` — Legacy CLI (do not refactor; Celery workers import from here)

Stack: PostgreSQL + SQLAlchemy 2.0 async + Alembic + Redis + Ollama (local LLM) + fal.ai FLUX + edge-tts + faster-whisper + Selenium/Firefox.

---

## Dev Commands

```bash
uvicorn backend.main:app --reload --port 8000
celery -A backend.workers.celery_app worker -Q remotion,youtube,twitter -c 1
cd remotion-service && npm run dev     # port 3001
cd frontend && npm run dev             # port 5173
python src/main.py                     # legacy CLI (smoke testing)
alembic upgrade head                   # run DB migrations
python scripts/preflight_local.py      # validate environment
```

---

## Hard Rules

1. **`src/` bare imports** — files inside `src/` use bare names (`from config import x`). Workers call `sys.path.insert(0, "src")` first.
2. **Do not refactor `src/`** — workers import `YouTube`, `Twitter`, `generate_text` directly. Break = silent job failure.
3. **LLM = Ollama only** — no OpenAI/Anthropic.
4. **No passwords in DB** — auth via Firefox profile sessions only.
5. **Celery = sync** (psycopg2). **FastAPI = async** (asyncpg). Never mix.
6. **Restart remotion-service** after editing compositions.

---

## Architecture Docs

| Topic | Doc |
|---|---|
| Stack + pipelines | [docs/architecture/overview.md](docs/architecture/overview.md) |
| DB schema | [docs/architecture/database.md](docs/architecture/database.md) |
| WebSocket events | [docs/architecture/websocket.md](docs/architecture/websocket.md) |
| Celery task pattern | [docs/architecture/celery.md](docs/architecture/celery.md) |
| src/ quirks | [docs/architecture/legacy-cli.md](docs/architecture/legacy-cli.md) |

---

## Celery Step Pattern (required)

```python
publish(step, "running", detail, pct, job_id)
update_step(db, step_obj, "running")
result = do_work()
update_step(db, step_obj, "done", str(result), meta)
publish(step, "done", str(result), pct + delta, job_id)
# if external API: insert_cost_record(db, service, cost_usd, job_id)
```

Never silence exceptions — let them propagate so the job status updates to `failed`.

---

## PR Guidelines

- Target `main`, one feature/fix per PR, link to issue
- `WIP` label until ready for review
- Commit: `feat(scope): description` or `fix(scope): description`
