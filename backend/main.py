import asyncio
import json
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.database import engine, Base
from backend.settings import settings
from backend.routes import jobs, accounts, videos, costs, config as config_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(title="MoneyPrinterV2 API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(videos.router, prefix="/api")
app.include_router(costs.router, prefix="/api")
app.include_router(config_router.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


@app.websocket("/ws/accounts/{account_id}")
async def account_websocket(websocket: WebSocket, account_id: str):
    await websocket.accept()
    r = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.subscribe(f"account:{account_id}")
    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            data = json.loads(message["data"])
            await websocket.send_json(data)
            if data.get("status") in ("connected", "timeout", "failed"):
                break
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(f"account:{account_id}")
        await pubsub.close()
        await r.aclose()


@app.websocket("/ws/jobs/{job_id}")
async def job_websocket(websocket: WebSocket, job_id: str):
    await websocket.accept()
    r = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.subscribe(f"job:{job_id}")

    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            data = json.loads(message["data"])
            await websocket.send_json(data)
            # Close WS when job finishes
            if data.get("event") in ("job_done", "job_failed"):
                break
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(f"job:{job_id}")
        await pubsub.close()
        await r.aclose()
