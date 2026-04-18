from celery import Celery
from backend.settings import settings

celery_app = Celery(
    "mpv2",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "backend.workers.youtube",
        "backend.workers.twitter",
        "backend.workers.remotion_generate",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_routes={
        "remotion.generate_video": {"queue": "remotion"},
        "youtube.generate_video":  {"queue": "youtube"},
        "twitter.post_tweet":      {"queue": "twitter"},
    },
)
