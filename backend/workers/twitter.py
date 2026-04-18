import json
import os
from datetime import datetime, timezone

from backend.workers.celery_app import celery_app
from backend.settings import settings


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="twitter.post_tweet")
def post_tweet(self, job_id: str, account_id: str, topic: str, model: str = "llama3.1:latest") -> dict:
    import re
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    import redis as _redis

    sync_url = settings.database_url.replace("+asyncpg", "+psycopg2")
    try:
        engine = create_engine(sync_url)
    except Exception:
        engine = create_engine(settings.database_url.replace("+asyncpg", ""))
    SessionLocal = sessionmaker(engine)
    r = _redis.from_url(settings.redis_url, decode_responses=True)

    def publish(step, status, detail="", progress=0):
        r.publish(f"job:{job_id}", json.dumps({
            "event": "step_update", "job_id": job_id,
            "step": step, "status": status, "detail": detail,
            "progress": progress, "timestamp": datetime.now(timezone.utc).isoformat(),
        }))

    with SessionLocal() as db:
        from backend.models.job import Job, PipelineStep
        from backend.models.post import Post

        job = db.get(Job, job_id)
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.error = None
        job.started_at = datetime.now(timezone.utc)
        job.celery_task_id = self.request.id
        db.commit()

        try:
            import sys
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../src"))
            from llm_provider import select_model, generate_text

            select_model(model)

            publish("generate_post", "running", "Generating tweet...", 20)
            content = generate_text(
                f"Write a tweet (max 260 chars) about: {topic}. "
                "No hashtag spam. Return ONLY the tweet text.",
                max_tokens=80,
            )
            content = re.sub(r"\*", "", content).strip()[:260]
            publish("generate_post", "done", content, 80)

            post = Post(job_id=job_id, account_id=account_id, platform="twitter", content=content)
            db.add(post)
            db.flush()
            job.status = "done"
            job.finished_at = datetime.now(timezone.utc)
            job.result = {"content": content, "post_id": str(post.id)}
            db.commit()

            r.publish(f"job:{job_id}", json.dumps({
                "event": "job_done", "job_id": job_id,
                "content": content, "timestamp": datetime.now(timezone.utc).isoformat(),
            }))
            return {"status": "done", "content": content}

        except Exception as exc:
            job.status = "failed"
            job.error = str(exc)
            job.finished_at = datetime.now(timezone.utc)
            db.commit()
            raise self.retry(exc=exc)
