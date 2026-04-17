from decimal import Decimal
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.cost import CostRecord, BudgetConfig
from backend.services.cost_tracker import get_daily_total, get_monthly_total

router = APIRouter(prefix="/costs", tags=["costs"])


class BudgetUpdateRequest(BaseModel):
    daily_limit_usd: float | None = None
    monthly_limit_usd: float | None = None
    alert_threshold: float | None = None


@router.get("")
async def get_cost_summary(db: AsyncSession = Depends(get_db)):
    daily = await get_daily_total(db)
    monthly = await get_monthly_total(db)
    total_result = await db.execute(select(func.sum(CostRecord.cost_usd)))
    total = float(total_result.scalar() or 0)
    return {"daily_usd": daily, "monthly_usd": monthly, "total_usd": total}


@router.get("/by-service")
async def costs_by_service(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CostRecord.service, func.sum(CostRecord.cost_usd).label("total"))
        .group_by(CostRecord.service)
        .order_by(func.sum(CostRecord.cost_usd).desc())
    )
    return [{"service": r.service, "total_usd": float(r.total)} for r in result.all()]


@router.get("/by-job")
async def costs_by_job(limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CostRecord.job_id, func.sum(CostRecord.cost_usd).label("total"))
        .where(CostRecord.job_id.isnot(None))
        .group_by(CostRecord.job_id)
        .order_by(func.sum(CostRecord.cost_usd).desc())
        .limit(limit)
    )
    return [{"job_id": str(r.job_id), "total_usd": float(r.total)} for r in result.all()]


@router.get("/budget")
async def get_budget(db: AsyncSession = Depends(get_db)):
    budget = await db.get(BudgetConfig, 1)
    if not budget:
        return {"daily_limit_usd": 10.0, "monthly_limit_usd": 100.0, "alert_threshold": 0.8}
    return {
        "daily_limit_usd": float(budget.daily_limit_usd),
        "monthly_limit_usd": float(budget.monthly_limit_usd),
        "alert_threshold": budget.alert_threshold,
    }


@router.put("/budget")
async def update_budget(req: BudgetUpdateRequest, db: AsyncSession = Depends(get_db)):
    budget = await db.get(BudgetConfig, 1)
    if not budget:
        budget = BudgetConfig(id=1)
        db.add(budget)
    if req.daily_limit_usd is not None:
        budget.daily_limit_usd = Decimal(str(req.daily_limit_usd))
    if req.monthly_limit_usd is not None:
        budget.monthly_limit_usd = Decimal(str(req.monthly_limit_usd))
    if req.alert_threshold is not None:
        budget.alert_threshold = req.alert_threshold
    await db.commit()
    return {"updated": True}
