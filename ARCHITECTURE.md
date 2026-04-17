# MoneyPrinterV2 — Architecture & Technical Specification

> Fuente de verdad para cualquier editor IA (Claude Code, Cursor, etc.) o desarrollador.
> Leer este documento completo antes de tocar cualquier archivo.

---

## 1. Visión del producto

MoneyPrinterV2 es una plataforma **local** (corre en tu PC, sin auth) para automatizar la creación y publicación de contenido en redes sociales usando IA.

### Qué hace
- Genera videos para YouTube Shorts completamente con IA (script → imágenes → TTS → subtítulos → MP4)
- Publica tweets automáticos generados con LLM
- Automatiza affiliate marketing (scraping Amazon + pitch en Twitter)
- Hace cold outreach (scraping Google Maps + email automatizado)

### Principios de diseño
1. **Local first** — corre en localhost, sin auth, sin multi-usuario
2. **Transparencia total** — el usuario ve cada paso del pipeline en tiempo real
3. **Control de costos** — cada operación registra tokens usados y costo en USD
4. **Sin magia negra** — logs detallados de todo lo que hace el sistema
5. **Escalable** — arquitectura que permite migrar a cloud/multi-usuario sin reescribir

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión | Razón |
|---|---|---|---|
| **Backend API** | FastAPI | ≥0.111 | Async nativo, WebSocket, Pydantic v2 |
| **Base de datos** | PostgreSQL | ≥15 | Concurrencia, ACID, JSON columns |
| **ORM** | SQLAlchemy | 2.0 | Async sessions, type-safe |
| **Migraciones** | Alembic | latest | Schema versioning |
| **Queue broker** | Redis | ≥7 | Celery broker + Pub/Sub + cache |
| **Workers** | Celery | ≥5.3 | Jobs async, retry, scheduling |
| **Frontend** | React + Vite | React 18 | SPA, hot reload |
| **UI Components** | shadcn/ui + Tailwind | latest | Componentes accesibles |
| **Real-time** | WebSocket (FastAPI) | — | Progress streaming al browser |
| **Containers** | Docker + docker-compose | — | Dev y prod idénticos |
| **LLM** | Ollama (local) | — | Gratis, privado |
| **Imágenes AI** | FAL.AI (FLUX schnell) | — | $0.003/imagen |
| **TTS** | KittenTTS (local) | — | Gratis |
| **STT** | faster-whisper (local) | — | Gratis |
| **Video** | MoviePy 1.x | 1.0.3 | Composición de video |

---

## 3. Estructura de directorios

```
MoneyPrinterV2/
├── backend/                    # FastAPI app (NUEVO)
│   ├── main.py                 # FastAPI app entry point
│   ├── database.py             # SQLAlchemy engine + session
│   ├── models/                 # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── account.py          # Cuentas YouTube/Twitter
│   │   ├── job.py              # Jobs de generación
│   │   ├── video.py            # Videos generados
│   │   ├── post.py             # Posts publicados
│   │   └── cost.py             # Registro de costos
│   ├── schemas/                # Pydantic schemas (request/response)
│   │   ├── account.py
│   │   ├── job.py
│   │   └── cost.py
│   ├── routes/                 # API endpoints
│   │   ├── accounts.py         # CRUD cuentas
│   │   ├── jobs.py             # Crear/ver jobs
│   │   ├── videos.py           # Ver videos generados
│   │   ├── costs.py            # Ver costos y budget
│   │   └── config.py           # Leer/escribir config.json
│   ├── workers/                # Celery tasks
│   │   ├── celery_app.py       # Celery instance + config
│   │   ├── youtube.py          # Task: generate_video
│   │   ├── twitter.py          # Task: post_tweet
│   │   └── outreach.py         # Task: run_outreach
│   └── services/               # Lógica de negocio
│       ├── cost_tracker.py     # Registro de tokens y costos
│       └── event_publisher.py  # Redis Pub/Sub publisher
├── frontend/                   # React app (NUEVO)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx   # Vista principal: jobs activos + stats
│   │   │   ├── YouTube.tsx     # Crear video, ver historial
│   │   │   ├── Twitter.tsx     # Crear tweet, ver historial
│   │   │   ├── Costs.tsx       # Budget tracker, costos por job
│   │   │   └── Config.tsx      # Editor de config.json
│   │   ├── components/
│   │   │   ├── JobCard.tsx     # Card de job con progreso en tiempo real
│   │   │   ├── PipelineView.tsx # Vista paso a paso del pipeline
│   │   │   ├── CostBadge.tsx   # Badge con costo en USD
│   │   │   └── VideoPreview.tsx # Player de video generado
│   │   └── hooks/
│   │       └── useJobStream.ts # Hook WebSocket para progreso
├── src/                        # Código original (se mantiene, workers lo importan)
│   ├── classes/
│   ├── llm_provider.py
│   ├── config.py
│   └── ...
├── alembic/                    # DB migrations (NUEVO)
├── docker-compose.yml          # NUEVO
├── Dockerfile.backend          # NUEVO
├── Dockerfile.worker           # NUEVO
├── .env.example                # NUEVO
├── config.json                 # Existente
└── ARCHITECTURE.md             # Este archivo
```

---

## 4. Base de datos — Schema completo

### accounts
```sql
CREATE TABLE accounts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform    VARCHAR(20) NOT NULL,  -- 'youtube' | 'twitter'
    nickname    VARCHAR(100) NOT NULL,
    niche       TEXT,                  -- solo YouTube
    language    VARCHAR(50),           -- solo YouTube
    topic       TEXT,                  -- solo Twitter
    firefox_profile_path TEXT,         -- path al perfil Firefox (legacy)
    oauth_token JSONB,                 -- token OAuth (futuro YouTube API)
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### jobs
```sql
CREATE TABLE jobs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type        VARCHAR(30) NOT NULL,  -- 'youtube_generate' | 'twitter_post' | 'outreach'
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
                                       -- pending | running | done | failed | cancelled
    account_id  UUID REFERENCES accounts(id),
    celery_task_id VARCHAR(100),       -- para consultar estado en Celery
    input       JSONB,                 -- parámetros del job (niche, topic, etc.)
    result      JSONB,                 -- resultado (video_path, url publicada, etc.)
    error       TEXT,                  -- mensaje de error si falló
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_account ON jobs(account_id);
```

### pipeline_steps
```sql
-- Cada paso del pipeline de generación, para el dashboard en tiempo real
CREATE TABLE pipeline_steps (
    id          BIGSERIAL PRIMARY KEY,
    job_id      UUID REFERENCES jobs(id) ON DELETE CASCADE,
    step        VARCHAR(50) NOT NULL,  -- ver sección 6 para lista de steps
    status      VARCHAR(20) NOT NULL,  -- pending | running | done | failed | skipped
    detail      TEXT,                  -- mensaje descriptivo para el usuario
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    meta        JSONB                  -- datos extra (ej: image_url, tokens_used)
);

CREATE INDEX idx_steps_job ON pipeline_steps(job_id);
```

### videos
```sql
CREATE TABLE videos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id      UUID REFERENCES jobs(id),
    account_id  UUID REFERENCES accounts(id),
    title       TEXT,
    description TEXT,
    script      TEXT,
    file_path   TEXT,                  -- path local al MP4
    youtube_url TEXT,                  -- URL publicada (si se subió)
    duration_seconds FLOAT,
    file_size_bytes  BIGINT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### posts
```sql
CREATE TABLE posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id      UUID REFERENCES jobs(id),
    account_id  UUID REFERENCES accounts(id),
    platform    VARCHAR(20) NOT NULL,
    content     TEXT NOT NULL,
    url         TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### cost_records
```sql
-- Cada llamada a un servicio externo queda registrada
CREATE TABLE cost_records (
    id              BIGSERIAL PRIMARY KEY,
    job_id          UUID REFERENCES jobs(id),
    service         VARCHAR(30) NOT NULL,  -- 'ollama' | 'fal_ai' | 'kittentts' | 'whisper' | 'assemblyai'
    operation       VARCHAR(50) NOT NULL,  -- 'generate_text' | 'generate_image' | 'tts' | 'stt'
    -- Tokens (para LLM)
    input_tokens    INTEGER DEFAULT 0,
    output_tokens   INTEGER DEFAULT 0,
    -- Costo en USD
    cost_usd        NUMERIC(10, 6) DEFAULT 0,
    -- Metadata
    model           VARCHAR(100),
    meta            JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_costs_job ON cost_records(job_id);
CREATE INDEX idx_costs_service ON cost_records(service);
```

### budget_config
```sql
-- Límites de gasto configurables por el usuario
CREATE TABLE budget_config (
    id              INTEGER PRIMARY KEY DEFAULT 1,  -- solo una fila
    daily_limit_usd NUMERIC(10,2) DEFAULT 10.00,
    monthly_limit_usd NUMERIC(10,2) DEFAULT 100.00,
    alert_threshold FLOAT DEFAULT 0.8,             -- alertar al 80% del límite
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. API REST — Endpoints completos

### Base URL: `http://localhost:8000/api`

#### Jobs
```
POST   /jobs/youtube/generate       Crear job de generación de video
POST   /jobs/twitter/post           Crear job de post en Twitter
POST   /jobs/outreach/start         Crear job de outreach
GET    /jobs                        Listar todos los jobs (con filtros: status, type)
GET    /jobs/{job_id}               Ver detalle de un job
GET    /jobs/{job_id}/steps         Ver pasos del pipeline (para dashboard)
DELETE /jobs/{job_id}               Cancelar job pendiente
```

#### Accounts
```
GET    /accounts                    Listar cuentas
POST   /accounts                    Crear cuenta
DELETE /accounts/{account_id}       Eliminar cuenta
```

#### Videos
```
GET    /videos                      Listar videos generados
GET    /videos/{video_id}           Ver detalle
GET    /videos/{video_id}/stream    Stream del archivo MP4
```

#### Costs
```
GET    /costs                       Resumen de costos (hoy, este mes, total)
GET    /costs/by-job                Costos agrupados por job
GET    /costs/by-service            Costos agrupados por servicio
GET    /costs/budget                Ver configuración de budget
PUT    /costs/budget                Actualizar límites de budget
```

#### Config
```
GET    /config                      Leer config.json completo
PATCH  /config                      Actualizar campos de config.json
```

#### WebSocket
```
WS     /ws/jobs/{job_id}            Stream de eventos de un job en tiempo real
```

---

## 6. Pipeline de generación de video — Pasos

Cada paso se guarda en `pipeline_steps` y se emite por WebSocket al frontend.

```
STEP                    DESCRIPCIÓN                         COSTO
─────────────────────────────────────────────────────────────────────
generate_topic          LLM genera idea del video           tokens LLM
generate_script         LLM genera script completo          tokens LLM
generate_metadata       LLM genera título + descripción     tokens LLM
generate_image_prompts  LLM genera prompts para imágenes    tokens LLM
generate_images         FAL.AI genera N imágenes            $0.003/img
synthesize_audio        KittenTTS convierte script a WAV    gratis
generate_subtitles      Whisper transcribe audio a SRT      gratis
compose_video           MoviePy combina todo en MP4         gratis (CPU)
upload_youtube          Sube MP4 a YouTube (opcional)       gratis
─────────────────────────────────────────────────────────────────────
```

### Evento WebSocket por paso
```json
{
  "event": "step_update",
  "job_id": "uuid",
  "step": "generate_images",
  "status": "running",
  "detail": "Generando imagen 2 de 3...",
  "progress": 66,
  "cost_usd": 0.006,
  "meta": {
    "image_url": "https://fal.run/...",
    "model": "fal-ai/flux/schnell"
  },
  "timestamp": "2026-04-17T01:23:45Z"
}
```

### Eventos WebSocket especiales
```json
{ "event": "job_started",   "job_id": "uuid", "total_steps": 9 }
{ "event": "job_done",      "job_id": "uuid", "video_path": "...", "total_cost_usd": 0.024 }
{ "event": "job_failed",    "job_id": "uuid", "error": "FAL.AI timeout", "step": "generate_images" }
{ "event": "budget_alert",  "threshold": 0.8, "used_today_usd": 8.00, "limit_usd": 10.00 }
```

---

## 7. Sistema de costos — Precios de referencia

```python
COST_TABLE = {
    # LLM (Ollama local = gratis, pero trackear tokens igual)
    "ollama": {
        "input_per_1k_tokens":  0.0,
        "output_per_1k_tokens": 0.0,
    },
    # Cuando se integre Claude API (futuro)
    "claude_haiku": {
        "input_per_1k_tokens":  0.00025,
        "output_per_1k_tokens": 0.00125,
    },
    "claude_sonnet": {
        "input_per_1k_tokens":  0.003,
        "output_per_1k_tokens": 0.015,
    },
    # FAL.AI
    "fal_flux_schnell": {
        "per_image": 0.003,
    },
    "fal_flux_dev": {
        "per_image": 0.025,
    },
    # AssemblyAI (si se usa)
    "assemblyai": {
        "per_minute_audio": 0.0062,
    },
    # ElevenLabs (futuro)
    "elevenlabs": {
        "per_1k_chars": 0.15,
    },
}
```

El `cost_tracker.py` expone:
```python
async def record_llm_call(job_id, model, input_tokens, output_tokens) -> float
async def record_image_gen(job_id, model, n_images) -> float
async def record_tts(job_id, provider, n_chars) -> float
async def get_daily_total() -> float
async def get_monthly_total() -> float
async def check_budget_exceeded() -> bool
```

---

## 8. Celery — Tasks

### celery_app.py
```python
# Broker: Redis
# Backend (results): Redis
# Concurrencia: 2 workers por defecto (configurable)
# Timezone: UTC
# Task serializer: json
```

### Task: generate_youtube_video
```python
@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def generate_youtube_video(self, job_id: str, account_id: str, niche: str, language: str):
    # 1. Actualizar job status = running en DB
    # 2. Para cada paso del pipeline:
    #    a. Insertar pipeline_step con status=running
    #    b. Publicar evento Redis (job_id, step, running)
    #    c. Ejecutar paso
    #    d. Registrar costo en cost_records
    #    e. Actualizar pipeline_step status=done
    #    f. Publicar evento Redis (job_id, step, done, cost)
    # 3. Guardar video en tabla videos
    # 4. Actualizar job status = done
    # 5. Publicar evento Redis job_done
```

### Task: post_twitter
```python
@celery_app.task(bind=True, max_retries=3)
def post_twitter(self, job_id: str, account_id: str, topic: str):
    # 1. status = running
    # 2. generate_post (LLM) → registrar tokens
    # 3. post via Selenium/Twitter API
    # 4. guardar en posts table
    # 5. status = done
```

### Scheduled tasks (Celery Beat)
```python
# Se configuran desde el dashboard, no hardcodeados
# Ejemplo: generar video para cuenta X cada día a las 9am
# Se guardan en DB y Celery Beat los pickea
```

---

## 9. Frontend — Vistas y componentes

### Dashboard (página principal)
```
┌─────────────────────────────────────────────────────────┐
│  Jobs activos (en tiempo real)                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🎬 Generando video "Funny cats" — cuenta @lucho │   │
│  │ ████████████░░░░░░  66% — Generando imágenes   │   │
│  │ ✓ Topic  ✓ Script  ✓ Metadata  ◉ Images  ○ ... │   │
│  │ Costo hasta ahora: $0.009                       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Stats de hoy                                           │
│  Videos: 3  │  Tweets: 5  │  Gasto: $0.045 / $10.00   │
│                                                         │
│  Últimos videos generados                               │
│  [thumbnail] [thumbnail] [thumbnail]                    │
└─────────────────────────────────────────────────────────┘
```

### PipelineView (componente central)
Muestra cada paso del pipeline con:
- Ícono de estado (pending/running/done/failed)
- Nombre del paso
- Tiempo transcurrido
- Costo en USD
- Detalle expandible (texto del script, URL de imagen, etc.)
- Animación mientras corre

### Costs (página)
```
┌──────────────────────────────────────────────────────────┐
│  Budget mensual: $12.50 / $100.00  ████░░░░░░  12.5%    │
│  Budget diario:  $0.045 / $10.00   ░░░░░░░░░░  0.45%    │
│                                                           │
│  Gasto por servicio (este mes)                           │
│  FAL.AI:    $8.20  (2,733 imágenes)                     │
│  Ollama:    $0.00  (local, 1.2M tokens)                  │
│  KittenTTS: $0.00  (local)                               │
│                                                           │
│  Historial por job                                        │
│  Job #42  Funny cats video    $0.024   2026-04-17       │
│  Job #41  Twitter post        $0.000   2026-04-17       │
└──────────────────────────────────────────────────────────┘
```

---

## 10. Docker Compose — Servicios

```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: mpv2
      POSTGRES_USER: mpv2
      POSTGRES_PASSWORD: mpv2
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://mpv2:mpv2@postgres/mpv2
      REDIS_URL: redis://redis:6379
    volumes:
      - .:/app           # monta repo completo para acceder a src/ y config.json
      - .mp:/app/.mp     # videos generados
    depends_on:
      - postgres
      - redis

  worker:
    build: ./backend
    command: celery -A workers.celery_app worker --loglevel=info --concurrency=2
    environment:
      DATABASE_URL: postgresql+asyncpg://mpv2:mpv2@postgres/mpv2
      REDIS_URL: redis://redis:6379
    volumes:
      - .:/app
      - .mp:/app/.mp
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

## 11. Variables de entorno (.env)

```env
# Database
DATABASE_URL=postgresql+asyncpg://mpv2:mpv2@localhost/mpv2

# Redis
REDIS_URL=redis://localhost:6379

# FAL.AI
FAL_KEY=your_fal_api_key_here

# Ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434

# Paths
MP_DIR=/app/.mp
CONFIG_PATH=/app/config.json
```

---

## 12. Convenciones de código

### Backend (Python)
- Python 3.12+
- Type hints en todas las funciones
- `async/await` en routes y DB queries
- SQLAlchemy 2.0 style (no legacy)
- Pydantic v2 para schemas
- Sin comentarios obvios, solo cuando el WHY no es claro

### Frontend (TypeScript)
- React functional components, no class components
- Custom hooks para lógica reutilizable
- `useJobStream(jobId)` — hook central para WebSocket
- Tailwind para estilos, sin CSS custom salvo casos excepcionales

### Celery tasks
- Siempre `bind=True` para acceso a `self` (retry)
- Publicar evento Redis al inicio y fin de cada paso
- Registrar costo en `cost_records` después de cada llamada a API externa
- Nunca silenciar excepciones — dejar fallar y registrar el error en DB

---

## 13. Orden de implementación (para editores IA)

Implementar en este orden exacto. No saltear pasos.

```
STEP 1 — Infraestructura base
  - docker-compose.yml
  - .env.example
  - Dockerfile.backend
  - alembic/ init + primera migration (todos los modelos)

STEP 2 — Backend esqueleto
  - backend/main.py (FastAPI app, CORS, rutas)
  - backend/database.py (engine async, session)
  - backend/models/ (todos los modelos SQLAlchemy)
  - backend/schemas/ (Pydantic schemas)

STEP 3 — Celery
  - backend/workers/celery_app.py
  - backend/services/event_publisher.py (Redis pub/sub)
  - backend/services/cost_tracker.py
  - backend/workers/youtube.py (generate_youtube_video task)

STEP 4 — API Routes
  - backend/routes/jobs.py
  - backend/routes/accounts.py
  - backend/routes/costs.py
  - backend/routes/config.py
  - WebSocket endpoint en main.py

STEP 5 — Frontend base
  - frontend/ setup (Vite + React + Tailwind + shadcn)
  - hooks/useJobStream.ts
  - components/PipelineView.tsx
  - pages/Dashboard.tsx

STEP 6 — Frontend completo
  - pages/YouTube.tsx (crear job + ver historial)
  - pages/Costs.tsx (budget tracker)
  - components/VideoPreview.tsx
  - components/CostBadge.tsx
```

---

## 14. Lo que NO cambiar del código existente

El código en `src/` funciona y genera videos correctamente. Los workers de Celery lo **importan directamente** — no reescriben la lógica.

```python
# worker correcto: importar y llamar, no reescribir
from src.llm_provider import select_model, generate_text
from src.classes.Tts import TTS
from src.classes.YouTube import YouTube  # solo para métodos de generación, no upload
```

Lo único que cambia en `src/`:
- `config.py` — agregar getters para nuevas config keys si se necesitan
- `classes/YouTube.py` — reemplazar `upload_video()` con YouTube Data API (TASK-03, futuro)

---

## 15. Glosario

| Término | Definición |
|---|---|
| **Job** | Unidad de trabajo async (ej: "generar video para cuenta @lucho") |
| **Pipeline** | Secuencia de pasos para completar un job |
| **Step** | Un paso individual del pipeline (generate_topic, generate_images, etc.) |
| **Cost record** | Registro de una llamada a servicio externo con su costo en USD |
| **Budget** | Límite de gasto diario/mensual configurable |
| **Worker** | Proceso Celery que ejecuta jobs en background |
| **Event** | Mensaje Redis Pub/Sub emitido cuando cambia el estado de un step |
| **niche** | Temática del canal YouTube (ej: "funny cats", "finance tips") |
