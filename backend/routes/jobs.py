import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.job import Job, PipelineStep
from backend.workers.youtube import generate_video
from backend.workers.twitter import post_tweet

router = APIRouter(prefix="/jobs", tags=["jobs"])


class GenerateVideoRequest(BaseModel):
    account_id: str
    niche: str
    language: str = "English"
    model: str = "llama3.1:latest"


class PostTweetRequest(BaseModel):
    account_id: str
    topic: str
    model: str = "llama3.1:latest"


@router.post("/youtube/generate")
async def create_youtube_job(req: GenerateVideoRequest, db: AsyncSession = Depends(get_db)):
    job = Job(
        type="youtube_generate",
        account_id=req.account_id,
        input={"niche": req.niche, "language": req.language, "model": req.model},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    task = generate_video.delay(str(job.id), req.account_id, req.niche, req.language)
    job.celery_task_id = task.id
    await db.commit()
    return {"job_id": str(job.id), "status": "pending"}


@router.post("/twitter/post")
async def create_twitter_job(req: PostTweetRequest, db: AsyncSession = Depends(get_db)):
    job = Job(
        type="twitter_post",
        account_id=req.account_id,
        input={"topic": req.topic, "model": req.model},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    task = post_tweet.delay(str(job.id), req.account_id, req.topic, req.model)
    job.celery_task_id = task.id
    await db.commit()
    return {"job_id": str(job.id), "status": "pending"}


@router.get("")
async def list_jobs(
    status: str | None = None,
    type: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    q = select(Job).order_by(Job.created_at.desc()).limit(limit)
    if status:
        q = q.where(Job.status == status)
    if type:
        q = q.where(Job.type == type)
    result = await db.execute(q)
    jobs = result.scalars().all()
    return [_job_to_dict(j) for j in jobs]


@router.get("/{job_id}")
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return _job_to_dict(job)


@router.get("/{job_id}/steps")
async def get_job_steps(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PipelineStep).where(PipelineStep.job_id == job_id).order_by(PipelineStep.id)
    )
    steps = result.scalars().all()
    return [
        {
            "step": s.step, "status": s.status, "detail": s.detail,
            "started_at": s.started_at, "finished_at": s.finished_at, "meta": s.meta,
        }
        for s in steps
    ]


@router.delete("/{job_id}")
async def cancel_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status not in ("pending",):
        raise HTTPException(400, f"Cannot cancel job with status '{job.status}'")
    job.status = "cancelled"
    await db.commit()
    return {"status": "cancelled"}


def _job_to_dict(job: Job) -> dict:
    return {
        "id": str(job.id), "type": job.type, "status": job.status,
        "account_id": str(job.account_id) if job.account_id else None,
        "input": job.input, "result": job.result, "error": job.error,
        "started_at": job.started_at, "finished_at": job.finished_at,
        "created_at": job.created_at,
    }
