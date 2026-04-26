# backend/ — Claude Code Guide

FastAPI REST API + Celery workers. Python 3.12.

## Structure

```
backend/
  main.py           FastAPI app: CORS, WebSocket endpoints, router registration
  database.py       Async SQLAlchemy engine (asyncpg) + get_db() dependency
  settings.py       Pydantic Settings — reads from .env
  models/           SQLAlchemy ORM models (account, job, video, post, cost)
  schemas/          Pydantic v2 request/response schemas
  routes/           FastAPI routers (accounts, jobs, videos, costs, config)
  services/         Business logic called by routes
  workers/          Celery tasks (celery_app.py, youtube.py, twitter.py, remotion_generate.py)
```

## Key Rules

**Routes are async, workers are sync:**
```python
# Routes — use AsyncSession + asyncpg
async def route(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job))

# Celery workers — use sync psycopg2 session, no async/await
def task(self, job_id: str):
    with sync_session() as db:
        job = db.execute(select(Job).where(Job.id == job_id)).scalar()
```

**WebSocket channels:** `job:{job_id}` and `account:{account_id}` — forward Redis Pub/Sub to browser. See [../docs/architecture/websocket.md](../docs/architecture/websocket.md).

**Celery task step pattern** — every step must publish + update DB. See [../docs/architecture/celery.md](../docs/architecture/celery.md).

**src/ imports in workers:**
```python
import sys
sys.path.insert(0, "src")   # must be first, before any src/ import
from llm_provider import generate_text
from classes.YouTube import YouTube
```

## Dev Commands

```bash
# API server
uvicorn backend.main:app --reload --port 8000

# Workers
celery -A backend.workers.celery_app worker -Q remotion,youtube,twitter -c 1

# Migrations
alembic upgrade head
alembic revision --autogenerate -m "description"

# API docs
open http://localhost:8000/docs
```

## Schema Reference

Full DB schema → [../docs/architecture/database.md](../docs/architecture/database.md)

## Settings (.env)

```env
DATABASE_URL=postgresql+asyncpg://mpv2:mpv2@localhost:5432/mpv2
REDIS_URL=redis://localhost:6379/0
FAL_KEY=your_key
TAVILY_API_KEY=optional
OLLAMA_BASE_URL=http://localhost:11434
REMOTION_SERVICE_URL=http://localhost:3001
MP_DIR=.mp
CONFIG_PATH=config.json
```
