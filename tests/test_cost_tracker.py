"""
Validation tests for cost_tracker service and /costs API endpoints.
Run: python tests/test_cost_tracker.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://mpv2:mpv2@localhost:5432/mpv2")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import delete

from backend.settings import settings
from backend.database import Base
from backend.models.cost import CostRecord, BudgetConfig
from backend.models.job import Job
from backend.services.cost_tracker import (
    record_llm_call, record_image_gen, record_tts,
    get_daily_total, get_monthly_total, check_budget_exceeded,
    COST_TABLE,
)

engine = create_async_engine(settings.database_url, echo=False)
Session = async_sessionmaker(engine, expire_on_commit=False)

PASS = "✓"
FAIL = "✗"
errors = []


def check(label: str, actual, expected, tol=1e-6):
    ok = abs(actual - expected) < tol
    status = PASS if ok else FAIL
    print(f"  {status} {label}: got={actual:.6f} expected={expected:.6f}")
    if not ok:
        errors.append(f"{label}: got={actual:.6f} expected={expected:.6f}")


async def cleanup(db):
    await db.execute(delete(CostRecord))
    await db.execute(delete(BudgetConfig))
    await db.commit()


async def test_llm_cost_math():
    print("\n[1] LLM cost math (ollama = free, tokens still recorded)")
    async with Session() as db:
        await cleanup(db)
        cost = await record_llm_call(db, None, "ollama", input_tokens=1000, output_tokens=500)
        check("ollama cost = 0.0", cost, 0.0)

        # Verify record written
        from sqlalchemy import select
        result = await db.execute(select(CostRecord))
        records = result.scalars().all()
        assert len(records) == 1, f"Expected 1 record, got {len(records)}"
        r = records[0]
        assert r.input_tokens == 1000, f"input_tokens={r.input_tokens}"
        assert r.output_tokens == 500, f"output_tokens={r.output_tokens}"
        assert r.service == "llm"
        assert r.operation == "generate_text"
        print(f"  {PASS} record written: service={r.service} input_tokens={r.input_tokens} output_tokens={r.output_tokens}")

    print("\n[2] LLM cost math (claude_haiku pricing)")
    async with Session() as db:
        await cleanup(db)
        # 2000 input tokens @ $0.00025/1k = $0.0005
        # 800 output tokens @ $0.00125/1k = $0.001
        # total = $0.0015
        cost = await record_llm_call(db, None, "claude_haiku", input_tokens=2000, output_tokens=800)
        expected = (2000/1000 * 0.00025) + (800/1000 * 0.00125)
        check("claude_haiku cost", cost, expected)

    print("\n[3] LLM cost math (claude_sonnet pricing)")
    async with Session() as db:
        await cleanup(db)
        # 1500 input @ $0.003/1k = $0.0045
        # 300 output @ $0.015/1k = $0.0045
        # total = $0.009
        cost = await record_llm_call(db, None, "claude_sonnet", input_tokens=1500, output_tokens=300)
        expected = (1500/1000 * 0.003) + (300/1000 * 0.015)
        check("claude_sonnet cost", cost, expected)


async def test_image_gen_cost():
    print("\n[4] Image generation cost (FAL flux/schnell)")
    async with Session() as db:
        await cleanup(db)
        cost = await record_image_gen(db, None, "fal-ai/flux/schnell", n_images=3)
        expected = 3 * 0.003
        check("3 images flux/schnell", cost, expected)

        from sqlalchemy import select
        result = await db.execute(select(CostRecord))
        r = result.scalars().first()
        assert r.service == "fal_ai"
        assert r.meta["n_images"] == 3
        print(f"  {PASS} meta.n_images={r.meta['n_images']} service={r.service}")

    print("\n[5] Image generation cost (FAL flux/dev)")
    async with Session() as db:
        await cleanup(db)
        cost = await record_image_gen(db, None, "fal-ai/flux/dev", n_images=1)
        expected = 1 * 0.025
        check("1 image flux/dev", cost, expected)


async def test_tts_cost():
    print("\n[6] TTS cost (kittentts = free)")
    async with Session() as db:
        await cleanup(db)
        cost = await record_tts(db, None, "kittentts", n_chars=500)
        check("kittentts 500 chars = 0.0", cost, 0.0)

    print("\n[7] TTS cost (elevenlabs pricing)")
    async with Session() as db:
        await cleanup(db)
        cost = await record_tts(db, None, "elevenlabs", n_chars=2000)
        expected = 2000 / 1000 * 0.15
        check("elevenlabs 2000 chars", cost, expected)


async def test_daily_monthly_totals():
    print("\n[8] Daily/monthly totals aggregate correctly")
    async with Session() as db:
        await cleanup(db)

        # Insert known costs
        c1 = await record_image_gen(db, None, "fal-ai/flux/schnell", n_images=2)   # $0.006
        c2 = await record_image_gen(db, None, "fal-ai/flux/schnell", n_images=1)   # $0.003
        c3 = await record_llm_call(db, None, "ollama", 1000, 500)                  # $0.000

        daily = await get_daily_total(db)
        monthly = await get_monthly_total(db)
        expected_total = c1 + c2 + c3

        check("daily total", daily, expected_total)
        check("monthly total", monthly, expected_total)


async def test_budget_exceeded():
    print("\n[9] Budget alert — daily limit")
    async with Session() as db:
        await cleanup(db)

        budget = BudgetConfig(id=1, daily_limit_usd=Decimal("0.005"), monthly_limit_usd=Decimal("100.0"))
        db.add(budget)
        await db.commit()

        # Under limit
        exceeded, msg = await check_budget_exceeded(db)
        assert not exceeded, f"Should not be exceeded yet, got: {msg}"
        print(f"  {PASS} under limit: exceeded={exceeded}")

        # Push over daily limit ($0.006 > $0.005)
        await record_image_gen(db, None, "fal-ai/flux/schnell", n_images=2)  # $0.006
        exceeded, msg = await check_budget_exceeded(db)
        assert exceeded, f"Should be exceeded now"
        assert "Daily" in msg
        print(f"  {PASS} over daily limit: exceeded={exceeded} msg='{msg}'")

    print("\n[10] Budget alert — monthly limit")
    async with Session() as db:
        await cleanup(db)

        budget = BudgetConfig(id=1, daily_limit_usd=Decimal("100.0"), monthly_limit_usd=Decimal("0.002"))
        db.add(budget)
        await db.commit()

        await record_image_gen(db, None, "fal-ai/flux/schnell", n_images=1)  # $0.003 > $0.002
        exceeded, msg = await check_budget_exceeded(db)
        assert exceeded
        assert "Monthly" in msg
        print(f"  {PASS} over monthly limit: exceeded={exceeded} msg='{msg}'")


async def test_by_job_aggregation():
    print("\n[11] Cost aggregation by job_id")
    async with Session() as db:
        await cleanup(db)

        # Need a real job to satisfy FK constraint
        from backend.models.account import Account
        from sqlalchemy import delete as _del
        await db.execute(_del(Job))
        await db.execute(_del(Account))
        await db.commit()

        acc = Account(platform="youtube", nickname="test")
        db.add(acc)
        await db.commit()

        job1 = Job(type="youtube_generate", status="done", account_id=acc.id)
        job2 = Job(type="youtube_generate", status="done", account_id=acc.id)
        db.add(job1)
        db.add(job2)
        await db.commit()

        await record_image_gen(db, str(job1.id), "fal-ai/flux/schnell", n_images=3)  # $0.009
        await record_image_gen(db, str(job1.id), "fal-ai/flux/schnell", n_images=1)  # $0.003
        await record_image_gen(db, str(job2.id), "fal-ai/flux/schnell", n_images=2)  # $0.006

        from sqlalchemy import select, func
        result = await db.execute(
            select(CostRecord.job_id, func.sum(CostRecord.cost_usd).label("total"))
            .where(CostRecord.job_id.isnot(None))
            .group_by(CostRecord.job_id)
        )
        rows = {str(r.job_id): float(r.total) for r in result.all()}

        check(f"job1 total (3+1 images)", rows[str(job1.id)], 0.012)
        check(f"job2 total (2 images)", rows[str(job2.id)], 0.006)

        # Cleanup FK
        await db.execute(_del(CostRecord))
        await db.execute(_del(Job))
        await db.execute(_del(Account))
        await db.commit()


async def main():
    print("=" * 55)
    print("  Cost Tracker Validation")
    print("=" * 55)

    await test_llm_cost_math()
    await test_image_gen_cost()
    await test_tts_cost()
    await test_daily_monthly_totals()
    await test_budget_exceeded()
    await test_by_job_aggregation()

    print("\n" + "=" * 55)
    if errors:
        print(f"FAILED — {len(errors)} assertion(s):")
        for e in errors:
            print(f"  {FAIL} {e}")
        sys.exit(1)
    else:
        print("ALL TESTS PASSED")
    print("=" * 55)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
