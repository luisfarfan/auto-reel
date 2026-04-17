import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.job import Job, PipelineStep
from backend.schemas.job import (
    GenerateVideoRequest, PostTweetRequest,
    JobResponse, PipelineStepResponse,
)
from backend.workers.youtube import generate_video
from backend.workers.twitter import post_tweet

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/youtube/generate", status_code=202)
async def create_youtube_job(req: GenerateVideoRequest, db: AsyncSession = Depends(get_db)):
    job = Job(
        type="youtube_generate",
        account_id=req.account_id,
        input={"niche": req.niche, "language": req.language, "model": req.model},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    task = generate_video.delay(str(job.id), str(req.account_id), req.niche, req.language)
    job.celery_task_id = task.id
    await db.commit()
    return {"job_id": str(job.id), "status": "pending"}


@router.post("/twitter/post", status_code=202)
async def create_twitter_job(req: PostTweetRequest, db: AsyncSession = Depends(get_db)):
    job = Job(
        type="twitter_post",
        account_id=req.account_id,
        input={"topic": req.topic, "model": req.model},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    task = post_tweet.delay(str(job.id), str(req.account_id), req.topic, req.model)
    job.celery_task_id = task.id
    await db.commit()
    return {"job_id": str(job.id), "status": "pending"}


@router.get("", response_model=list[JobResponse])
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
    return result.scalars().all()


def _parse_uuid(value: str) -> _uuid.UUID:
    try:
        return _uuid.UUID(value)
    except ValueError:
        raise HTTPException(404, "Not found")


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, _parse_uuid(job_id))
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.get("/{job_id}/steps", response_model=list[PipelineStepResponse])
async def get_job_steps(job_id: str, db: AsyncSession = Depends(get_db)):
    uid = _parse_uuid(job_id)
    result = await db.execute(
        select(PipelineStep).where(PipelineStep.job_id == uid).order_by(PipelineStep.id)
    )
    return result.scalars().all()


@router.delete("/{job_id}")
async def cancel_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, _parse_uuid(job_id))
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status not in ("pending",):
        raise HTTPException(400, f"Cannot cancel job with status '{job.status}'")
    job.status = "cancelled"
    await db.commit()
    return {"status": "cancelled"}
