import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.account import Account

router = APIRouter(prefix="/accounts", tags=["accounts"])


class CreateAccountRequest(BaseModel):
    platform: str  # youtube | twitter
    nickname: str
    niche: str | None = None
    language: str | None = "English"
    topic: str | None = None
    firefox_profile_path: str | None = None


@router.get("")
async def list_accounts(platform: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Account).order_by(Account.created_at.desc())
    if platform:
        q = q.where(Account.platform == platform)
    result = await db.execute(q)
    return [_to_dict(a) for a in result.scalars().all()]


@router.post("")
async def create_account(req: CreateAccountRequest, db: AsyncSession = Depends(get_db)):
    account = Account(**req.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return _to_dict(account)


@router.delete("/{account_id}")
async def delete_account(account_id: str, db: AsyncSession = Depends(get_db)):
    account = await db.get(Account, account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    await db.delete(account)
    await db.commit()
    return {"deleted": account_id}


def _to_dict(a: Account) -> dict:
    return {
        "id": str(a.id), "platform": a.platform, "nickname": a.nickname,
        "niche": a.niche, "language": a.language, "topic": a.topic,
        "firefox_profile_path": a.firefox_profile_path,
        "created_at": a.created_at,
    }
