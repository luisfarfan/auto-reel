import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, Text, ForeignKey, Integer, Numeric, func, BigInteger, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB

from backend.database import Base


class CostRecord(Base):
    __tablename__ = "cost_records"
    __table_args__ = (
        Index("idx_costs_job", "job_id"),
        Index("idx_costs_service", "service"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id"))
    service: Mapped[str] = mapped_column(String(30), nullable=False)
    operation: Mapped[str] = mapped_column(String(50), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(10, 6), default=0)
    model: Mapped[str | None] = mapped_column(String(100))
    meta: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BudgetConfig(Base):
    __tablename__ = "budget_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    daily_limit_usd: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=10.00)
    monthly_limit_usd: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=100.00)
    alert_threshold: Mapped[float] = mapped_column(default=0.8)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
