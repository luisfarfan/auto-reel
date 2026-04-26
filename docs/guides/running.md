# Running the Project

## All Services (Docker)

```bash
docker-compose up
```

## Individual Services (Development)

Each layer runs independently. Start all of them for full functionality.

### 1. PostgreSQL + Redis (required by everything)

```bash
docker-compose up postgres redis -d
# or use local installs
```

### 2. FastAPI Backend (port 8000)

```bash
source venv/bin/activate
uvicorn backend.main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/docs

### 3. Celery Workers

```bash
source venv/bin/activate
celery -A backend.workers.celery_app worker -Q remotion,youtube,twitter -c 1
```

Concurrency is 1 (`-c 1`) to avoid resource contention between Chromium and Firefox.

### 4. Remotion Service (port 3001)

```bash
cd remotion-service
npm install   # first time only
npm run dev
```

First request after startup triggers Webpack bundle build (~30s). Subsequent renders use the cache.

### 5. React Frontend (port 5173)

```bash
cd frontend
npm install   # first time only
npm run dev
```

Open http://localhost:5173

### 6. Legacy CLI (smoke testing / standalone use)

```bash
source venv/bin/activate
python src/main.py
```

Must run from project root.

## DB Migrations

```bash
# Apply all pending migrations
alembic upgrade head

# Create new migration from model changes
alembic revision --autogenerate -m "add tiktok accounts"

# Rollback one step
alembic downgrade -1
```

## Validate Environment

```bash
python scripts/preflight_local.py
```

Checks: Ollama reachable, config.json exists, .mp/ writable, ImageMagick found.
