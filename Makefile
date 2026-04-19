.PHONY: help install dev dev-backend dev-frontend dev-remotion worker db-up db-down migrate logs clean

# Ports
BACKEND_PORT  := 8001
FRONTEND_PORT := 5173
REMOTION_PORT := 3001

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Setup ─────────────────────────────────────────────────────────────────────

install: ## Install all dependencies
	@echo "[backend] installing..."
	python -m venv venv && . venv/bin/activate && pip install -r requirements.txt -r requirements.backend.txt
	@echo "[frontend] installing..."
	cd frontend && npm install
	@echo "[remotion] installing..."
	cd remotion-service && npm install

# ── Dev (individual) ──────────────────────────────────────────────────────────

dev-backend: ## Start FastAPI backend (port 8001)
	. venv/bin/activate && uvicorn backend.main:app --host 0.0.0.0 --port $(BACKEND_PORT) --reload

dev-frontend: ## Start React/Vite frontend (port 5173)
	cd frontend && npm run dev

dev-remotion: ## Start Remotion Express service (port 3001)
	cd remotion-service && npm run dev

worker: ## Start Celery worker
	. venv/bin/activate && celery -A backend.workers.celery_app worker --loglevel=info -Q remotion,youtube,twitter -c 1

# ── Dev (all at once) ─────────────────────────────────────────────────────────

dev: db-up ## Start all services (backend + frontend + remotion + worker)
	@echo "Starting all services..."
	@. venv/bin/activate && uvicorn backend.main:app --host 0.0.0.0 --port $(BACKEND_PORT) --reload &
	@. venv/bin/activate && celery -A backend.workers.celery_app worker --loglevel=info -Q remotion,youtube,twitter -c 1 &
	@cd remotion-service && npm run dev &
	@cd frontend && npm run dev

# ── Infrastructure ────────────────────────────────────────────────────────────

db-up: ## Start PostgreSQL + Redis via Docker Compose
	docker compose up postgres redis -d

db-down: ## Stop PostgreSQL + Redis
	docker compose stop postgres redis

migrate: ## Run Alembic migrations
	. venv/bin/activate && alembic upgrade head

# ── Docker (full stack) ───────────────────────────────────────────────────────

docker-up: ## Start full stack via Docker Compose
	docker compose up --build

docker-down: ## Stop full Docker stack
	docker compose down

# ── Misc ──────────────────────────────────────────────────────────────────────

logs: ## Tail docker compose logs
	docker compose logs -f

clean: ## Remove venv, node_modules, __pycache__, .mp temp files
	rm -rf venv frontend/node_modules remotion-service/node_modules
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find .mp -type f ! -name "*.json" -delete 2>/dev/null || true
