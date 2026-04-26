# WebSocket & Real-time Events

FastAPI WebSocket endpoints forward Redis Pub/Sub messages to the browser.

## Channels

### `job:{job_id}` — Pipeline progress

Emitted by Celery workers via `publish(step, status, detail, progress_pct)`.

```json
{ "event": "job_started",
  "job_id": "uuid",
  "total_steps": 9 }

{ "event": "step_update",
  "job_id": "uuid",
  "step": "generate_images",
  "status": "running",
  "detail": "Image 2 of 4...",
  "progress": 55,
  "cost_usd": 0.003,
  "meta": {},
  "timestamp": "2026-04-26T12:00:00Z" }

{ "event": "job_done",
  "job_id": "uuid",
  "video_path": "/abs/path/to/video.mp4",
  "video_id": "uuid",
  "total_cost_usd": 0.024 }

{ "event": "job_failed",
  "job_id": "uuid",
  "error": "fal.ai returned 429" }
```

### `account:{account_id}` — Account connect flow

Emitted by the account connect background task.

```json
{ "event": "connect_update",
  "account_id": "uuid",
  "status": "waiting|detected|saving|connected|timeout|failed",
  "message": "Waiting for login... (47s)",
  "timestamp": "2026-04-26T12:00:00Z" }
```

Status transitions:
```
opening → waiting → detected → saving → connected
                             ↘ timeout
                             ↘ failed
```

## WebSocket Endpoints (backend/main.py)

```
WS /ws/jobs/{job_id}         → subscribes to job:{job_id}
WS /ws/accounts/{account_id} → subscribes to account:{account_id}
```

Connection closes automatically when terminal status received:
- Jobs: `job_done` or `job_failed`
- Accounts: `connected`, `timeout`, or `failed`

## Frontend Hooks

```typescript
// frontend/src/hooks/useJobStream.ts
const { steps, status, totalCost } = useJobStream(jobId)

// frontend/src/hooks/useAccountStream.ts
const { status, message, isConnecting, isDone } = useAccountStream(accountId)
// status: "idle"|"opening"|"waiting"|"detected"|"saving"|"connected"|"timeout"|"failed"
```

## Publishing from Celery (Python)

```python
import redis, json
from backend.settings import settings

def publish(step: str, status: str, detail: str, progress: int, job_id: str):
    r = redis.from_url(settings.redis_url)
    r.publish(f"job:{job_id}", json.dumps({
        "event": "step_update",
        "job_id": job_id,
        "step": step,
        "status": status,
        "detail": detail,
        "progress": progress,
    }))
```
