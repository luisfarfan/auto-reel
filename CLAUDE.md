# CLAUDE.md

> Claude Code guide for MoneyPrinterV2.
> This file = critical rules + orientation. Full docs in [docs/index.md](docs/index.md).

---

## What This Is

Local-first AI content automation platform. 4 layers:

| Layer | Location | Language |
|---|---|---|
| Backend API + Workers | `backend/` | Python 3.12 / FastAPI + Celery |
| Video renderer | `remotion-service/` | Node.js / TypeScript / Remotion 4 |
| Dashboard | `frontend/` | React 18 / TypeScript / Tailwind |
| Legacy CLI (do not refactor) | `src/` | Python 3.12 |

Each directory has its own `CLAUDE.md` loaded automatically when working in it.

---

## Start Here

| Need | Go To |
|---|---|
| Run any layer | [docs/guides/running.md](docs/guides/running.md) |
| First-time setup | [docs/guides/setup.md](docs/guides/setup.md) |
| DB schema | [docs/architecture/database.md](docs/architecture/database.md) |
| WebSocket events | [docs/architecture/websocket.md](docs/architecture/websocket.md) |
| Celery task pattern | [docs/architecture/celery.md](docs/architecture/celery.md) |
| Why src/ is weird | [docs/architecture/legacy-cli.md](docs/architecture/legacy-cli.md) |
| Stack overview | [docs/architecture/overview.md](docs/architecture/overview.md) |
| All docs | [docs/index.md](docs/index.md) |

---

## Non-Negotiable Rules

### 1. src/ import path — breaks silently if wrong

`src/` uses `sys.path` injection. All files inside `src/` import bare names:
```python
from config import get_ollama_model     # correct
from src.config import get_ollama_model # WRONG — ImportError at runtime
```
Workers must call `sys.path.insert(0, "src")` before any `src/` import.

### 2. Do not refactor src/

Celery workers import `from classes.YouTube import YouTube` and `from llm_provider import generate_text` directly. Any rename/move silently breaks jobs. New features go in `backend/`.

### 3. LLM = Ollama only

Never add OpenAI or Anthropic as LLM providers. Use `src/llm_provider.py` → `generate_text(prompt)`.

### 4. No passwords in DB

Auth = Firefox profile (cookie sessions). `accounts.connected = true` means valid session exists. No credentials stored anywhere.

### 5. Celery tasks are sync, FastAPI routes are async

Celery uses psycopg2 (sync). FastAPI uses asyncpg (async). Never mix drivers.

### 6. Remotion bundle requires restart

After editing `remotion-service/src/compositions/` or `components/`, restart the service. Bundle builds once at startup.

---

## Services & Ports

| Service | Port |
|---|---|
| FastAPI | 8000 |
| React frontend | 5173 |
| Remotion | 3001 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Ollama | 11434 |

---

## Contributing

PRs against `main`. One feature/fix per PR. Open issue first.
Commit style: `feat(scope): description` or `fix(scope): description`.
