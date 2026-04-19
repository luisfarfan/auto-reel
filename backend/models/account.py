import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB

from backend.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    platform: Mapped[str] = mapped_column(String(20), nullable=False)  # youtube | twitter
    nickname: Mapped[str] = mapped_column(String(100), nullable=False)
    niche: Mapped[str | None] = mapped_column(String(500))
    language: Mapped[str | None] = mapped_column(String(50))
    topic: Mapped[str | None] = mapped_column(String(500))
    firefox_profile_path: Mapped[str | None] = mapped_column(String(500))
    connected: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    last_connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    oauth_token: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
