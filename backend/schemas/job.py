import uuid
from datetime import datetime
from pydantic import BaseModel


class GenerateVideoRequest(BaseModel):
    account_id: uuid.UUID
    niche: str
    language: str = "English"
    model: str = "llama3.1:latest"


class PostTweetRequest(BaseModel):
    account_id: uuid.UUID
    topic: str
    model: str = "llama3.1:latest"


class JobResponse(BaseModel):
    id: uuid.UUID
    type: str
    status: str
    account_id: uuid.UUID | None
    celery_task_id: str | None
    input: dict | None
    result: dict | None
    error: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PipelineStepResponse(BaseModel):
    step: str
    status: str
    detail: str | None
    started_at: datetime | None
    finished_at: datetime | None
    meta: dict | None

    model_config = {"from_attributes": True}
