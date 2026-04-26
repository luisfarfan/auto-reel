# Database Schema

PostgreSQL ≥15. SQLAlchemy 2.0 async (asyncpg driver). Migrations via Alembic.

```bash
alembic upgrade head
alembic revision --autogenerate -m "description"
```

---

## accounts

```sql
CREATE TABLE accounts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform             VARCHAR(20) NOT NULL,   -- 'youtube' | 'twitter'
    nickname             VARCHAR(100) NOT NULL,
    niche                TEXT,
    language             VARCHAR(50),
    firefox_profile_path TEXT,                   -- absolute path to Firefox profile dir
    connected            BOOLEAN DEFAULT FALSE,  -- true = valid cookie session detected
    last_connected_at    TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);
```

> No passwords or OAuth tokens. Auth = Firefox profile cookie session.
> `connected=true` means the profile has a verified active session.

---

## jobs

```sql
CREATE TABLE jobs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type           VARCHAR(30) NOT NULL,
                   -- 'youtube_generate' | 'twitter_post' | 'remotion_generate'
    status         VARCHAR(20) NOT NULL DEFAULT 'pending',
                   -- pending | running | done | failed | cancelled
    account_id     UUID REFERENCES accounts(id),
    celery_task_id VARCHAR(100),
    input          JSONB,   -- job parameters
    result         JSONB,   -- output (video_path, video_id, etc.)
    error          TEXT,
    started_at     TIMESTAMPTZ,
    finished_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

---

## pipeline_steps

```sql
CREATE TABLE pipeline_steps (
    id          BIGSERIAL PRIMARY KEY,
    job_id      UUID REFERENCES jobs(id) ON DELETE CASCADE,
    step        VARCHAR(50) NOT NULL,
                -- e.g. 'generate_script', 'generate_images', 'render_video'
    status      VARCHAR(20) NOT NULL,
                -- pending | running | done | failed | skipped
    detail      TEXT,
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    meta        JSONB       -- arbitrary step metadata (image count, cost, etc.)
);
```

---

## videos

```sql
CREATE TABLE videos (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id           UUID REFERENCES jobs(id),
    account_id       UUID REFERENCES accounts(id),
    title            TEXT,
    description      TEXT,
    script           TEXT,
    file_path        TEXT,
    youtube_url      TEXT,               -- populated after Selenium upload
    duration_seconds FLOAT,
    file_size_bytes  BIGINT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

---

## posts

```sql
CREATE TABLE posts (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id     UUID REFERENCES jobs(id),
    account_id UUID REFERENCES accounts(id),
    platform   VARCHAR(20) NOT NULL,  -- 'twitter'
    content    TEXT,
    url        TEXT,                  -- populated after successful post
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## cost_records

```sql
CREATE TABLE cost_records (
    id         BIGSERIAL PRIMARY KEY,
    job_id     UUID REFERENCES jobs(id),
    service    VARCHAR(50) NOT NULL,  -- 'fal.ai', 'tavily', 'edge-tts', etc.
    operation  VARCHAR(100),          -- e.g. 'generate_image', 'search'
    cost_usd   NUMERIC(10, 6),
    meta       JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## ORM Models Location

```
backend/models/
  account.py   → Account model
  job.py       → Job + PipelineStep models
  video.py     → Video model
  post.py      → Post model
  cost.py      → CostRecord model
```

## Session Usage

**FastAPI routes** (async):
```python
from backend.database import get_db
async def route(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job))
```

**Celery tasks** (sync — use psycopg2, not asyncpg):
```python
from sqlalchemy import create_engine
# Celery tasks create a sync engine from DATABASE_URL with +psycopg2 driver
```
