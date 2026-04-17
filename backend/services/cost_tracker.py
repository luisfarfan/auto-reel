from decimal import Decimal
from datetime import datetime, timezone, date

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.cost import CostRecord, BudgetConfig

COST_TABLE = {
    "ollama":            {"input_per_1k": 0.0,     "output_per_1k": 0.0},
    "claude_haiku":      {"input_per_1k": 0.00025, "output_per_1k": 0.00125},
    "claude_sonnet":     {"input_per_1k": 0.003,   "output_per_1k": 0.015},
    "fal_flux_schnell":  {"per_image": 0.003},
    "fal_flux_dev":      {"per_image": 0.025},
    "assemblyai":        {"per_minute": 0.0062},
    "elevenlabs":        {"per_1k_chars": 0.15},
    "kittentts":         {"per_1k_chars": 0.0},
    "whisper":           {"per_minute": 0.0},
}


async def record_llm_call(
    db: AsyncSession,
    job_id: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    key = model.lower().replace("-", "_").replace(".", "_")
    rates = COST_TABLE.get(key, COST_TABLE["ollama"])
    cost = (input_tokens / 1000 * rates["input_per_1k"]) + (output_tokens / 1000 * rates["output_per_1k"])
    record = CostRecord(
        job_id=job_id, service="llm", operation="generate_text",
        input_tokens=input_tokens, output_tokens=output_tokens,
        cost_usd=Decimal(str(cost)), model=model,
    )
    db.add(record)
    await db.commit()
    return cost


async def record_image_gen(
    db: AsyncSession,
    job_id: str,
    model: str,
    n_images: int,
) -> float:
    key = model.lower().replace("/", "_").replace("-", "_")
    key = "fal_flux_schnell" if "schnell" in key else "fal_flux_dev" if "dev" in key else "fal_flux_schnell"
    cost = COST_TABLE[key]["per_image"] * n_images
    record = CostRecord(
        job_id=job_id, service="fal_ai", operation="generate_image",
        cost_usd=Decimal(str(cost)), model=model,
        meta={"n_images": n_images},
    )
    db.add(record)
    await db.commit()
    return cost


async def record_tts(
    db: AsyncSession,
    job_id: str,
    provider: str,
    n_chars: int,
) -> float:
    rates = COST_TABLE.get(provider, {"per_1k_chars": 0.0})
    cost = n_chars / 1000 * rates.get("per_1k_chars", 0.0)
    record = CostRecord(
        job_id=job_id, service=provider, operation="tts",
        cost_usd=Decimal(str(cost)), meta={"chars": n_chars},
    )
    db.add(record)
    await db.commit()
    return cost


async def get_daily_total(db: AsyncSession) -> float:
    today = date.today()
    result = await db.execute(
        select(func.sum(CostRecord.cost_usd)).where(
            func.date(CostRecord.created_at) == today
        )
    )
    return float(result.scalar() or 0)


async def get_monthly_total(db: AsyncSession) -> float:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(func.sum(CostRecord.cost_usd)).where(
            func.extract("year", CostRecord.created_at) == now.year,
            func.extract("month", CostRecord.created_at) == now.month,
        )
    )
    return float(result.scalar() or 0)


async def check_budget_exceeded(db: AsyncSession) -> tuple[bool, str]:
    budget = await db.get(BudgetConfig, 1)
    if not budget:
        return False, ""
    daily = await get_daily_total(db)
    monthly = await get_monthly_total(db)
    if daily >= float(budget.daily_limit_usd):
        return True, f"Daily budget exceeded: ${daily:.4f} / ${budget.daily_limit_usd}"
    if monthly >= float(budget.monthly_limit_usd):
        return True, f"Monthly budget exceeded: ${monthly:.4f} / ${budget.monthly_limit_usd}"
    return False, ""
