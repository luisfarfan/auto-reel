# Celery — Jobs & Task Pattern

## Overview

Celery ≥5.3 with Redis as broker + result backend. Three queues, one worker process.

## Queues & Task Routes

```python
task_routes = {
    "remotion.generate_video": {"queue": "remotion"},
    "youtube.generate_video":  {"queue": "youtube"},
    "twitter.post_tweet":      {"queue": "twitter"},
}
```

## Start Worker

```bash
# All queues, concurrency=1 (avoids resource contention with Chromium + Firefox)
celery -A backend.workers.celery_app worker -Q remotion,youtube,twitter -c 1

# Specific queue only
celery -A backend.workers.celery_app worker -Q youtube -c 1
```

## Task Files

```
backend/workers/
  celery_app.py          Celery instance + task_routes config
  youtube.py             Task: youtube.generate_video
  twitter.py             Task: twitter.post_tweet
  remotion_generate.py   Task: remotion.generate_video
```

## Required Step Pattern

Every pipeline step must follow this exact pattern:

```python
# 1. Signal start
publish(step_name, "running", "Description of what's happening", progress_pct, job_id)
update_step(db, step_obj, "running")

# 2. Do the work
result = do_actual_work()

# 3. Signal done
update_step(db, step_obj, "done", str(result), {"key": "val"})
publish(step_name, "done", str(result), progress_pct + delta, job_id)

# 4. Record cost if external API was called
insert_cost_record(db, service="fal.ai", operation="generate_image",
                   cost_usd=0.003, job_id=job_id)
```

**Never silence exceptions.** Let them propagate — the task framework catches and marks the job as `failed`.

## Celery Tasks Are Sync

Celery workers use `psycopg2` (synchronous). FastAPI routes use `asyncpg` (async).

```python
# In a Celery task — sync DB session
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

# Do NOT use async/await inside Celery tasks
# Do NOT use AsyncSession inside Celery tasks
```

## sys.path for src/ Imports

Workers import directly from `src/`:

```python
import sys
sys.path.insert(0, "src")   # done at top of each worker file

from llm_provider import generate_text
from classes.YouTube import YouTube   # upload_video()
from classes.Twitter import Twitter   # post()
```

This must be done before any `src/` import. The `src/` modules expect bare names.

## Adding a New Task

1. Create `backend/workers/my_task.py`
2. Add task name to `celery_app.conf.update(task_routes=...)` in `celery_app.py`
3. Add module to `include=[...]` in `celery_app.py`
4. Add new queue to worker start command (`-Q remotion,youtube,twitter,my_queue`)
5. Follow the step pattern above — publish Redis events + update DB steps
