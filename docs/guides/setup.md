# First-Time Setup

## Prerequisites

- Python 3.12
- Node.js 18+
- PostgreSQL ≥15
- Redis ≥7
- Ollama (local LLM server)
- Firefox + geckodriver
- ImageMagick (`/usr/bin/convert` on Linux)
- Go (only for Outreach feature)

## Steps

### 1. Clone and configure

```bash
git clone <repo>
cd MoneyPrinterV2
cp config.example.json config.json   # fill in values
cp .env.example .env                 # fill in values
```

### 2. Python environment

```bash
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Database

```bash
# Start PostgreSQL (or use docker-compose)
docker-compose up postgres -d

# Run migrations
alembic upgrade head
```

### 4. Redis

```bash
docker-compose up redis -d
# or: redis-server
```

### 5. Remotion service

```bash
cd remotion-service
npm install
```

### 6. Frontend

```bash
cd frontend
npm install
```

### 7. Ollama

```bash
# Install from https://ollama.ai
ollama pull qwen2.5-coder:7b   # recommended for tech video scripts
ollama pull llama3.2:3b         # lighter alternative
```

### 8. Validate

```bash
python scripts/preflight_local.py
```

### macOS Quick Setup

```bash
bash scripts/setup_local.sh
```

Auto-configures Ollama, ImageMagick, and Firefox profile.

## Connect Platform Accounts

Use the dashboard (http://localhost:5173) → YouTube or Twitter page → Connect Account.

This opens a Firefox window. Log in manually. MPV2 saves the session profile — no credentials stored.

See [../features/youtube-shorts.md](../features/youtube-shorts.md) for details.
