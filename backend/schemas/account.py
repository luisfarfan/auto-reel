import uuid
from datetime import datetime
from pydantic import BaseModel


class CreateAccountRequest(BaseModel):
    platform: str  # youtube | twitter
    nickname: str
    niche: str | None = None
    language: str | None = "English"
    topic: str | None = None
    firefox_profile_path: str | None = None


class AccountResponse(BaseModel):
    id: uuid.UUID
    platform: str
    nickname: str
    niche: str | None
    language: str | None
    topic: str | None
    firefox_profile_path: str | None
    connected: bool
    last_connected_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
