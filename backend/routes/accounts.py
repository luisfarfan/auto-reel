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


def _read_firefox_cookies(profile_dir: str) -> list[dict]:
    """Read cookies from Firefox profile's cookies.sqlite without Selenium."""
    import sqlite3
    cookies_db = os.path.join(profile_dir, "cookies.sqlite")
    if not os.path.exists(cookies_db):
        return []
    try:
        # Copy DB first — Firefox holds a lock on it while running
        import shutil, tempfile
        tmp = tempfile.mktemp(suffix=".sqlite")
        shutil.copy2(cookies_db, tmp)
        con = sqlite3.connect(tmp)
        rows = con.execute("SELECT name, value, host FROM moz_cookies").fetchall()
        con.close()
        os.unlink(tmp)
        return [{"name": r[0], "value": r[1], "host": r[2]} for r in rows]
    except Exception:
        return []


def _connect_flow(account_id: str, platform: str):
    import redis as _redis
    import subprocess as _sp
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

    # Remove stale lock files from crashed previous sessions
    for lock in ("lock", ".parentlock"):
        lock_path = os.path.join(profile_dir, lock)
        if os.path.lexists(lock_path):
            os.remove(lock_path)

    ff_proc = None
    try:
        _publish(r, account_id, "opening", "Opening Firefox...")

        env = os.environ.copy()
        env.setdefault("DISPLAY", ":0")
        env.setdefault("DRI_PRIME", "1")
        if not env.get("XAUTHORITY"):
            xauth = f"/run/user/{os.getuid()}/gdm/Xauthority"
            if os.path.exists(xauth):
                env["XAUTHORITY"] = xauth

        # Kill stale Firefox so -new-instance isn't blocked
        _sp.run(["pkill", "-x", "firefox"], capture_output=True)
        time.sleep(1)

        # Launch plain Firefox — NOT via Selenium so Google doesn't block login
        target_url = PLATFORM_URLS.get(platform, "https://www.youtube.com")
        ff_proc = _sp.Popen(
            ["firefox", "--new-instance", "--no-remote", "--profile", profile_dir, target_url],
            env=env,
            stdout=_sp.DEVNULL,
            stderr=_sp.DEVNULL,
        )

        _publish(r, account_id, "waiting", f"Log in to {platform} in the Firefox window that just opened. Waiting... ({CONNECT_TIMEOUT}s)")

        cookie_name = PLATFORM_COOKIES.get(platform, "LOGIN_INFO")
        deadline = time.time() + CONNECT_TIMEOUT
        detected = False

        while time.time() < deadline:
            remaining = int(deadline - time.time())
            _publish(r, account_id, "waiting", f"Waiting for login... ({remaining}s remaining)")

            # Read cookies directly from profile SQLite — no Selenium needed
            cookies = _read_firefox_cookies(profile_dir)
            if any(c["name"] == cookie_name for c in cookies):
                detected = True
                break

            # Also stop if Firefox was closed by user
            if ff_proc.poll() is not None:
                # Give it one final cookie check after close
                cookies = _read_firefox_cookies(profile_dir)
                if any(c["name"] == cookie_name for c in cookies):
                    detected = True
                break

            time.sleep(POLL_INTERVAL)

        if not detected:
            _publish(r, account_id, "timeout", "Timed out or Firefox closed before login was detected. Please try again.")
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
        if ff_proc and ff_proc.poll() is None:
            try:
                ff_proc.terminate()
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
