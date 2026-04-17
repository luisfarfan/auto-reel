import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.account import Account
from backend.schemas.account import CreateAccountRequest, AccountResponse

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _parse_uuid(value: str) -> _uuid.UUID:
    try:
        return _uuid.UUID(value)
    except ValueError:
        raise HTTPException(404, "Not found")


@router.get("", response_model=list[AccountResponse])
async def list_accounts(platform: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Account).order_by(Account.created_at.desc())
    if platform:
        q = q.where(Account.platform == platform)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=AccountResponse, status_code=201)
async def create_account(req: CreateAccountRequest, db: AsyncSession = Depends(get_db)):
    account = Account(**req.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}")
async def delete_account(account_id: str, db: AsyncSession = Depends(get_db)):
    account = await db.get(Account, _parse_uuid(account_id))
    if not account:
        raise HTTPException(404, "Account not found")
    await db.delete(account)
    await db.commit()
    return {"deleted": account_id}
