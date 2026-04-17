import json
from datetime import datetime, timezone

import redis.asyncio as aioredis

from backend.settings import settings

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def publish_step(
    job_id: str,
    step: str,
    status: str,
    detail: str = "",
    progress: int = 0,
    cost_usd: float = 0.0,
    meta: dict | None = None,
) -> None:
    payload = {
        "event": "step_update",
        "job_id": job_id,
        "step": step,
        "status": status,
        "detail": detail,
        "progress": progress,
        "cost_usd": cost_usd,
        "meta": meta or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await get_redis().publish(f"job:{job_id}", json.dumps(payload))


async def publish_job_event(job_id: str, event: str, data: dict | None = None) -> None:
    payload = {
        "event": event,
        "job_id": job_id,
        **(data or {}),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await get_redis().publish(f"job:{job_id}", json.dumps(payload))
