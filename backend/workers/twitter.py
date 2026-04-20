import json
import os
import sys
from datetime import datetime, timezone

from backend.workers.celery_app import celery_app
from backend.settings import settings

STEPS = ["generate_post", "post_tweet"]


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

    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../src"))

    browser = None
    with SessionLocal() as db:
        from backend.models.job import Job
        from backend.models.post import Post
        from backend.models.account import Account

        job = db.get(Job, job_id)
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.error = None
        job.started_at = datetime.now(timezone.utc)
        job.celery_task_id = self.request.id
        db.commit()

        try:
            from llm_provider import select_model, generate_text

            select_model(model)

            # Step 1: generate tweet text
            publish("generate_post", "running", "Generating tweet...", 20)
            content = generate_text(
                f"Write a tweet (max 260 chars) about: {topic}. "
                "No hashtag spam. Return ONLY the tweet text.",
                max_tokens=80,
            )
            content = re.sub(r"\*", "", content).strip()
            if len(content) > 260:
                content = content[:257].rsplit(" ", 1)[0] + "..."
            publish("generate_post", "done", content, 50)

            # Step 2: post to Twitter via Selenium
            publish("post_tweet", "running", "Opening Firefox...", 60)

            account = db.get(Account, account_id)
            if not account:
                raise RuntimeError(f"Account {account_id} not found")
            if not account.firefox_profile_path:
                raise RuntimeError(
                    f"Account '{account.nickname}' has no Firefox profile path configured. "
                    "Connect the account first from the dashboard."
                )

            from classes.Twitter import Twitter

            twitter_bot = Twitter(
                account_uuid=str(account.id),
                account_nickname=account.nickname,
                fp_profile_path=account.firefox_profile_path,
                topic=topic,
            )
            browser = twitter_bot.browser

            publish("post_tweet", "running", "Posting tweet...", 80)
            twitter_bot.post(content)

            try:
                browser.quit()
            except Exception:
                pass
            browser = None

            publish("post_tweet", "done", "Posted successfully", 100)

            post = Post(
                job_id=job_id,
                account_id=account_id,
                platform="twitter",
                content=content,
            )
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
            if browser:
                try:
                    browser.quit()
                except Exception:
                    pass

            job.status = "failed"
            job.error = str(exc)
            job.finished_at = datetime.now(timezone.utc)
            db.commit()

            publish("post_tweet", "failed", str(exc), 0)
            raise self.retry(exc=exc)
