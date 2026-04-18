import os
import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.video import Video

router = APIRouter(prefix="/videos", tags=["videos"])


def _parse_uuid(value: str) -> _uuid.UUID:
    try:
        return _uuid.UUID(value)
    except ValueError:
        raise HTTPException(404, "Not found")


@router.get("")
async def list_videos(limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Video).order_by(Video.created_at.desc()).limit(limit))
    return [_to_dict(v) for v in result.scalars().all()]


@router.get("/by-job/{job_id}")
async def get_video_by_job(job_id: str, db: AsyncSession = Depends(get_db)):
    try:
        jid = _uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(404, "Not found")
    result = await db.execute(
        select(Video).where(Video.job_id == jid).order_by(Video.created_at.desc()).limit(1)
    )
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(404, "No video for this job")
    return _to_dict(video)


@router.get("/{video_id}")
async def get_video(video_id: str, db: AsyncSession = Depends(get_db)):
    video = await db.get(Video, _parse_uuid(video_id))
    if not video:
        raise HTTPException(404, "Video not found")
    return _to_dict(video)


@router.get("/{video_id}/stream")
async def stream_video(video_id: str, db: AsyncSession = Depends(get_db)):
    video = await db.get(Video, _parse_uuid(video_id))
    if not video or not video.file_path:
        raise HTTPException(404, "Video file not found")
    if not os.path.exists(video.file_path):
        raise HTTPException(404, f"File not found on disk: {video.file_path}")
    return FileResponse(video.file_path, media_type="video/mp4")


def _to_dict(v: Video) -> dict:
    return {
        "id": str(v.id), "job_id": str(v.job_id) if v.job_id else None,
        "account_id": str(v.account_id) if v.account_id else None,
        "title": v.title, "description": v.description,
        "file_path": v.file_path, "youtube_url": v.youtube_url,
        "duration_seconds": v.duration_seconds,
        "file_size_bytes": v.file_size_bytes,
        "created_at": v.created_at,
    }
