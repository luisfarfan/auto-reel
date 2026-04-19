import json
import os
import threading
import time
import uuid as _uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.account import Account
from backend.schemas.account import CreateAccountRequest, AccountResponse
from backend.settings import settings

router = APIRouter(prefix="/accounts", tags=["accounts"])

CONNECT_TIMEOUT = 300   # 5 minutes
POLL_INTERVAL  = 3      # seconds

# YouTube: LOGIN_INFO cookie  |  Twitter: auth_token cookie
PLATFORM_URLS    = {"youtube": "https://www.youtube.com", "twitter": "https://twitter.com"}
PLATFORM_COOKIES = {"youtube": "LOGIN_INFO",              "twitter": "auth_token"}


def _publish(r, account_id: str, status: str, message: str):
    r.publish(f"account:{account_id}", json.dumps({
        "event": "connect_update",
        "account_id": account_id,
        "status": status,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }))
    # Also store last status for polling fallback
    r.setex(f"account:{account_id}:connect_status", 600,
            json.dumps({"status": status, "message": message}))


def _connect_flow(account_id: str, platform: str):
    import redis as _redis
    from selenium import webdriver
    from selenium.webdriver.firefox.options import Options
    from selenium.webdriver.firefox.service import Service
    from webdriver_manager.firefox import GeckoDriverManager
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    r = _redis.from_url(settings.redis_url, decode_responses=True)

    sync_url = settings.database_url.replace("+asyncpg", "+psycopg2")
    try:
        engine = create_engine(sync_url)
    except Exception:
        engine = create_engine(settings.database_url.replace("+asyncpg", ""))
    Session = sessionmaker(engine)

    profile_dir = os.path.join(os.getcwd(), ".mp", "profiles", account_id)
    os.makedirs(profile_dir, exist_ok=True)

    driver = None
    try:
        _publish(r, account_id, "opening", "Opening Firefox...")

        opts = Options()
        opts.add_argument("-profile")
        opts.add_argument(profile_dir)
        service = Service(GeckoDriverManager().install())
        driver = webdriver.Firefox(service=service, options=opts)
        driver.get(PLATFORM_URLS.get(platform, "https://www.youtube.com"))

        _publish(r, account_id, "waiting", f"Waiting for login... ({CONNECT_TIMEOUT}s remaining)")

        cookie_name = PLATFORM_COOKIES.get(platform, "LOGIN_INFO")
        deadline = time.time() + CONNECT_TIMEOUT
        detected = False

        while time.time() < deadline:
            remaining = int(deadline - time.time())
            _publish(r, account_id, "waiting", f"Waiting for login... ({remaining}s remaining)")
            try:
                cookies = driver.get_cookies()
                if any(c["name"] == cookie_name for c in cookies):
                    detected = True
                    break
            except Exception:
                break
            time.sleep(POLL_INTERVAL)

        if not detected:
            _publish(r, account_id, "timeout", "Timed out after 5 minutes. Please try again.")
            return

        _publish(r, account_id, "detected", "Session detected! Saving profile...")

        with Session() as db:
            account = db.get(Account, _uuid.UUID(account_id))
            if account:
                account.firefox_profile_path = profile_dir
                account.connected = True
                account.last_connected_at = datetime.now(timezone.utc)
                db.commit()

        _publish(r, account_id, "connected", "Connected ✓")

    except Exception as exc:
        _publish(r, account_id, "failed", f"Error: {exc}")
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass


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


@router.post("/{account_id}/connect", status_code=202)
async def connect_account(account_id: str, db: AsyncSession = Depends(get_db)):
    account = await db.get(Account, _parse_uuid(account_id))
    if not account:
        raise HTTPException(404, "Account not found")
    thread = threading.Thread(
        target=_connect_flow,
        args=(str(account.id), account.platform),
        daemon=True,
    )
    thread.start()
    return {"status": "connecting", "message": "Firefox is opening..."}


@router.get("/{account_id}/connect/status")
async def connect_status(account_id: str):
    import redis as _redis
    r = _redis.from_url(settings.redis_url, decode_responses=True)
    raw = r.get(f"account:{account_id}:connect_status")
    if not raw:
        return {"status": "idle", "message": ""}
    return json.loads(raw)


@router.delete("/{account_id}")
async def delete_account(account_id: str, db: AsyncSession = Depends(get_db)):
    account = await db.get(Account, _parse_uuid(account_id))
    if not account:
        raise HTTPException(404, "Account not found")
    try:
        await db.delete(account)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Account has associated jobs and cannot be deleted")
    return {"deleted": account_id}
