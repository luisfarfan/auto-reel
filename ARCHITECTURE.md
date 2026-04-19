# MoneyPrinterV2 — Architecture & Technical Specification

> Fuente de verdad para Claude Code, Cursor, y cualquier desarrollador.
> Leer completo antes de tocar cualquier archivo.

---

## 1. Visión del producto

Plataforma **local** para automatizar creación y publicación de contenido usando IA.
Corre en localhost, sin auth, sin multi-usuario.

### Qué hace
- Genera **Tech Videos** con Remotion (script → imágenes → TTS → subtítulos → MP4 animado)
- Genera **YouTube Shorts** con MoviePy (mismo pipeline, composición más simple)
- Publica **tweets** automáticos vía Selenium
- **Conecta cuentas** via Firefox pre-autenticado (sin credenciales, sesión persistida en DB)
- **Sube videos** a YouTube automáticamente después de generarlos
- Automatiza affiliate marketing y cold outreach (legacy CLI)

### Principios de diseño
1. **Local first** — todo corre en localhost, Firefox abre en la misma máquina que el backend
2. **Transparencia total** — cada paso del pipeline visible en tiempo real via WebSocket
3. **Control de costos** — cada llamada externa registrada en `cost_records`
4. **Sin credenciales** — autenticación via perfiles Firefox pre-logueados, nunca passwords en DB
5. **Escalable** — arquitectura que permite migrar a cloud sin reescribir

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión | Razón |
|---|---|---|---|
| **Backend API** | FastAPI | ≥0.111 | Async nativo, WebSocket, Pydantic v2 |
| **Base de datos** | PostgreSQL | ≥15 | ACID, JSON columns |
| **ORM** | SQLAlchemy | 2.0 | Async sessions, type-safe |
| **Migraciones** | Alembic | latest | Schema versioning |
| **Queue broker** | Redis | ≥7 | Celery broker + Pub/Sub |
| **Workers** | Celery | ≥5.3 | Jobs async, retry |
| **Frontend** | React 18 + Vite | — | SPA, hot reload |
| **UI** | shadcn/ui + Tailwind | — | Componentes accesibles |
| **Real-time** | WebSocket (FastAPI) + Redis Pub/Sub | — | Progress streaming |
| **LLM** | Ollama (local) | — | Gratis, privado |
| **Imágenes AI** | fal.ai (FLUX schnell) | — | $0.003/imagen |
| **TTS** | edge-tts (Microsoft Neural) | — | Gratis, 7 idiomas |
| **STT** | faster-whisper (local) | — | Word-level timestamps |
| **Video Shorts** | MoviePy 1.x | — | Composición simple |
| **Video Tech** | Remotion 4 | — | React → MP4 via Chromium |
| **Web Search** | Tavily API | — | Contexto actualizado para LLM |
| **Browser Auto** | Selenium + Firefox | — | Upload YouTube, posts Twitter |

---

## 3. Estructura de directorios

```
MoneyPrinterV2/
├── backend/
│   ├── main.py                 # FastAPI app, CORS, WebSocket, rutas
│   ├── database.py             # SQLAlchemy engine + session
│   ├── settings.py             # Pydantic Settings (.env)
│   ├── models/
│   │   ├── account.py          # Cuentas YouTube/Twitter + estado de conexión
│   │   ├── job.py              # Jobs + PipelineStep
│   │   ├── video.py            # Videos generados
│   │   ├── post.py             # Posts publicados
│   │   └── cost.py             # Registro de costos
│   ├── schemas/
│   │   ├── job.py              # GenerateVideoRequest, GenerateTechVideoRequest, etc.
│   │   └── cost.py
│   ├── routes/
│   │   ├── accounts.py         # CRUD + /connect endpoint
│   │   ├── jobs.py             # Crear/ver jobs, steps
│   │   ├── videos.py           # Ver/stream videos
│   │   ├── costs.py            # Costos y budget
│   │   └── config.py           # Leer/escribir config.json
│   └── workers/
│       ├── celery_app.py       # Celery instance + task_routes
│       ├── youtube.py          # Task: youtube.generate_video
│       ├── twitter.py          # Task: twitter.post_tweet
│       └── remotion_generate.py # Task: remotion.generate_video
│
├── remotion-service/           # Microservicio Node.js
│   └── src/
│       ├── server.ts           # Express: /render, /health, /media (static)
│       ├── renderer.ts         # Remotion bundle cache + renderMedia()
│       ├── types.ts            # Zod schemas (RenderProps)
│       ├── compositions/       # TechDark, Minimal, Bold, Reel
│       └── components/         # GradientBackground, SubtitleWord, ImageScene,
│                               # CodeBlock, TitleCard, CodeTerminal, SplitScreen
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.tsx   # Jobs activos, stats, actividad reciente
│       │   ├── YouTube.tsx     # Crear Shorts + gestión cuentas + connect flow
│       │   ├── Twitter.tsx     # Crear tweets + gestión cuentas
│       │   ├── TechVideo.tsx   # Pipeline Remotion + video player
│       │   ├── Costs.tsx       # Budget tracker, costos por servicio
│       │   └── Config.tsx      # Editor config.json
│       ├── components/
│       │   ├── PipelineView.tsx  # Pasos del pipeline en tiempo real
│       │   ├── VideoPreview.tsx  # HTML5 player con controles
│       │   └── ConnectStatus.tsx # (NUEVO) Live status del connect flow
│       ├── hooks/
│       │   ├── useJobStream.ts      # WebSocket jobs
│       │   └── useAccountStream.ts  # (NUEVO) WebSocket account connect
│       └── lib/
│           └── api.ts          # Typed fetch client
│
├── src/                        # CLI original (no modificar)
│   ├── classes/YouTube.py      # upload_video() — usado por worker
│   ├── classes/Twitter.py      # post() — usado por worker
│   ├── llm_provider.py
│   ├── config.py
│   └── ...
│
├── alembic/                    # Migraciones DB
├── .mp/                        # Archivos temporales + videos generados
│   └── profiles/               # (NUEVO) Perfiles Firefox por cuenta
│       └── {account_id}/       # Perfil dedicado por cuenta
├── .env.example
├── config.example.json
└── docker-compose.yml
```

---

## 4. Base de datos — Schema

### accounts
```sql
CREATE TABLE accounts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform             VARCHAR(20) NOT NULL,   -- 'youtube' | 'twitter'
    nickname             VARCHAR(100) NOT NULL,
    niche                TEXT,
    language             VARCHAR(50),
    firefox_profile_path TEXT,                   -- path al perfil Firefox guardado
    connected            BOOLEAN DEFAULT FALSE,  -- sesión activa detectada
    last_connected_at    TIMESTAMPTZ,            -- última vez que se verificó la sesión
    created_at           TIMESTAMPTZ DEFAULT NOW()
);
```

> **Nota:** Sin passwords ni tokens OAuth. La autenticación es 100% via perfil Firefox.
> `connected=true` significa que el perfil tiene una sesión válida detectada por cookie check.

### jobs
```sql
CREATE TABLE jobs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type           VARCHAR(30) NOT NULL,   -- 'youtube_generate' | 'twitter_post' | 'remotion_generate'
    status         VARCHAR(20) NOT NULL DEFAULT 'pending',
                                           -- pending | running | done | failed | cancelled
    account_id     UUID REFERENCES accounts(id),
    celery_task_id VARCHAR(100),
    input          JSONB,                  -- parámetros del job
    result         JSONB,                  -- resultado (video_path, video_id, etc.)
    error          TEXT,
    started_at     TIMESTAMPTZ,
    finished_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### pipeline_steps
```sql
CREATE TABLE pipeline_steps (
    id          BIGSERIAL PRIMARY KEY,
    job_id      UUID REFERENCES jobs(id) ON DELETE CASCADE,
    step        VARCHAR(50) NOT NULL,
    status      VARCHAR(20) NOT NULL,   -- pending | running | done | failed | skipped
    detail      TEXT,
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    meta        JSONB
);
```

### videos
```sql
CREATE TABLE videos (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id           UUID REFERENCES jobs(id),
    account_id       UUID REFERENCES accounts(id),
    title            TEXT,
    description      TEXT,
    script           TEXT,
    file_path        TEXT,
    youtube_url      TEXT,               -- URL si fue subido
    duration_seconds FLOAT,
    file_size_bytes  BIGINT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### cost_records
```sql
CREATE TABLE cost_records (
    id            BIGSERIAL PRIMARY KEY,
    job_id        UUID REFERENCES jobs(id),
    service       VARCHAR(30) NOT NULL,   -- 'ollama' | 'fal_ai' | 'edge_tts' | 'whisper' | 'tavily'
    operation     VARCHAR(50) NOT NULL,
    cost_usd      NUMERIC(10, 6) DEFAULT 0,
    model         VARCHAR(100),
    meta          JSONB,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. API REST — Endpoints

### Base URL: `http://localhost:8001/api`

#### Jobs
```
POST   /jobs/youtube/generate       Crear job YouTube Shorts
POST   /jobs/twitter/post           Crear job tweet
POST   /jobs/remotion/generate      Crear job tech video
GET    /jobs                        Listar jobs (filtros: status, type)
GET    /jobs/{id}                   Detalle de job
GET    /jobs/{id}/steps             Pasos del pipeline
DELETE /jobs/{id}                   Cancelar job pendiente
```

#### Accounts
```
GET    /accounts                    Listar cuentas (filtro: platform)
POST   /accounts                    Crear cuenta
DELETE /accounts/{id}               Eliminar cuenta

POST   /accounts/{id}/connect       Lanzar Firefox, esperar login, guardar sesión
GET    /accounts/{id}/connect/status Estado actual del connect flow (polling fallback)
```

#### Videos
```
GET    /videos                      Listar videos
GET    /videos/by-job/{job_id}      Video de un job específico
GET    /videos/{id}                 Detalle
GET    /videos/{id}/stream          Stream MP4
```

#### Costs
```
GET    /costs                       Resumen (hoy, mes, total)
GET    /costs/by-job                Agrupado por job
GET    /costs/by-service            Agrupado por servicio
GET    /costs/budget                Ver límites
PUT    /costs/budget                Actualizar límites
```

#### WebSocket
```
WS     /ws/jobs/{job_id}            Eventos en tiempo real de un job
WS     /ws/accounts/{account_id}    (NUEVO) Eventos del connect flow
```

---

## 6. Pipelines — Pasos

### YouTube Shorts (`youtube.generate_video`)
```
STEP                    DESCRIPCIÓN                             OMITIBLE
────────────────────────────────────────────────────────────────────────
web_search              Tavily: contexto actualizado del topic  si web_search_enabled=false
generate_topic          LLM genera idea del video               si topic ya fue pasado
generate_script         LLM escribe script (~N palabras)
generate_metadata       LLM genera título + descripción
generate_image_prompts  LLM genera prompts para imágenes
generate_images         fal.ai genera N imágenes (3-6 según duration)
synthesize_audio        edge-tts convierte script a MP3
generate_subtitles      faster-whisper transcribe a SRT
compose_video           MoviePy combina en MP4
upload_youtube          Selenium sube a YouTube Studio          si auto_upload=false
```

**Parámetros job.input:**
```json
{
  "niche": "personal finance",
  "topic": "3 habits that changed my finances",   // opcional
  "language": "English",
  "model": "llama3.1:latest",
  "web_search_enabled": false,
  "duration_hint": "60s",                          // 30s|60s|90s|120s
  "auto_upload": true                              // subir automáticamente
}
```

### Tech Video (`remotion.generate_video`)
```
STEP                    DESCRIPCIÓN
────────────────────────────────────────────────
web_search              Tavily: noticias y docs actualizados
generate_script         Qwen2.5-Coder
generate_metadata       Título + descripción
generate_code_snippets  2-3 ejemplos de código (solo tech-dark)
generate_image_prompts  Prompts para fal.ai
generate_images         fal.ai FLUX
synthesize_audio        edge-tts (7 idiomas)
generate_subtitles      faster-whisper word-level timestamps
render_video            POST remotion-service/render → MP4
```

---

## 7. Account Connect Flow (NUEVO)

Permite al usuario conectar cuentas YouTube/Twitter desde el dashboard sin manejar credenciales.

### Flujo completo
```
1. Usuario hace clic en "Connect" en la account card del dashboard
2. Frontend llama POST /api/accounts/{id}/connect
3. Backend:
   a. Crea perfil Firefox en .mp/profiles/{account_id}/
   b. Lanza Firefox visible (headless=False) con ese perfil
   c. Navega a https://youtube.com (o twitter.com)
   d. Publica evento Redis: { status: "waiting", message: "Waiting for login..." }
   e. Poll cada 3s por hasta 5 minutos:
      - Verifica cookie LOGIN_INFO (YouTube) o auth_token (Twitter)
      - Si detectada: status "detected"
   f. Guarda profile_path en accounts table
   g. Marca connected=true, last_connected_at=now()
   h. Cierra Firefox
   i. Publica evento: { status: "connected" }
4. Frontend muestra "Connected ✓", badge verde en account card

Timeout: 5 minutos → status "timeout", connected permanece false
```

### Eventos WebSocket (canal `account:{id}`)
```json
{ "event": "connect_update", "account_id": "uuid", "status": "opening",   "message": "Opening Firefox..." }
{ "event": "connect_update", "account_id": "uuid", "status": "waiting",   "message": "Waiting for login... (290s remaining)" }
{ "event": "connect_update", "account_id": "uuid", "status": "detected",  "message": "Session detected!" }
{ "event": "connect_update", "account_id": "uuid", "status": "saving",    "message": "Saving profile..." }
{ "event": "connect_update", "account_id": "uuid", "status": "connected", "message": "Connected ✓" }
{ "event": "connect_update", "account_id": "uuid", "status": "timeout",   "message": "Timed out after 5 minutes" }
{ "event": "connect_update", "account_id": "uuid", "status": "failed",    "message": "Error: ..." }
```

### Cookie detection
```python
# YouTube
cookies = driver.get_cookies()
connected = any(c["name"] == "LOGIN_INFO" for c in cookies)

# Twitter
connected = any(c["name"] == "auth_token" for c in cookies)
```

### Requisitos del entorno
- Firefox debe poder abrir ventana visible (requiere DISPLAY)
- Backend y display en misma máquina (local dev) — funciona directo
- Backend headless (servidor remoto sin display) — requiere Xvfb + VNC (futuro)

---

## 8. Remotion Service

Microservicio Node.js independiente en `:3001`.

### Endpoints
```
POST /render     RenderProps → renderMedia() → MP4
GET  /health     { status: "ok", version: "1.0.0" }
GET  /templates  Lista templates y resolutions disponibles
GET  /media/*    Archivos estáticos de .mp/ (para que Chromium cargue imágenes/audio)
```

### RenderProps (Zod schema)
```typescript
{
  template:      "tech-dark" | "minimal" | "bold" | "reel"
  resolution:    "shorts" | "landscape" | "square"
  script:        string
  subtitles:     { word: string; start: number; end: number }[]
  audio_path?:   string   // path absoluto al MP3 de TTS
  images?:       string[] // paths absolutos a PNGs
  code_snippets?: { language: string; code: string; caption?: string }[]
  music_track?:  string   // filename en assets/music/
  music_volume?: number   // 0.0-1.0, default 0.15
  language?:     string
  output_path:   string
  fps?:          number   // default 30
}
```

### Bundle cache
El bundle Webpack se crea una vez al arrancar (`warmBundle()`) y se cachea en memoria.
**Si se modifican las composiciones hay que reiniciar el servicio** para rebuildar el bundle.

### Media serving
`app.use("/media", express.static(OUTPUT_DIR))` — sirve `.mp/` en `/media/`.
`toMediaUrl(path)` convierte paths absolutos a `http://localhost:3001/media/filename` para que Chromium los cargue.

---

## 9. Celery — Configuración

### Queues y task_routes
```python
task_routes = {
    "remotion.generate_video": {"queue": "remotion"},
    "youtube.generate_video":  {"queue": "youtube"},
    "twitter.post_tweet":      {"queue": "twitter"},
}
```

Arrancar worker con todas las queues:
```bash
celery -A backend.workers.celery_app worker -Q remotion,youtube,twitter -c 1
```

### Patrón estándar para cada step
```python
publish(step, "running", "Descripción...", progress_pct)
update_step(db, step, "running")
# ... ejecutar paso ...
update_step(db, step, "done", detalle, meta_dict)
publish(step, "done", detalle, progress_pct + 3)
```

---

## 10. WebSocket — Eventos

### Canal jobs: `job:{job_id}`
```json
{ "event": "job_started",   "job_id": "uuid", "total_steps": 9 }
{ "event": "step_update",   "job_id": "uuid", "step": "generate_images",
  "status": "running", "detail": "Image 2 of 4...", "progress": 55,
  "cost_usd": 0.003, "meta": {}, "timestamp": "..." }
{ "event": "job_done",      "job_id": "uuid", "video_path": "...",
  "video_id": "uuid", "total_cost_usd": 0.024 }
{ "event": "job_failed",    "job_id": "uuid", "error": "..." }
```

### Canal accounts: `account:{account_id}` (NUEVO)
```json
{ "event": "connect_update", "account_id": "uuid",
  "status": "waiting|detected|saving|connected|timeout|failed",
  "message": "...", "timestamp": "..." }
```

FastAPI WebSocket lee Redis Pub/Sub y hace forward al cliente.

---

## 11. Frontend — Páginas y componentes

### useAccountStream (NUEVO)
```typescript
// Mirrors useJobStream but for account connect events
const { status, message, isConnecting, isDone } = useAccountStream(accountId)
// status: "idle" | "opening" | "waiting" | "detected" | "saving" | "connected" | "timeout" | "failed"
```

### YouTube page — Account card (NUEVO)
```
┌─────────────────────────────────────────┐
│ @micanal  ·  finance · English          │
│ ● Connected  (last: hace 2 días)        │  ← badge verde/rojo
│                          [Connect] [🗑] │
└─────────────────────────────────────────┘

// Cuando se conecta:
┌─────────────────────────────────────────┐
│ @micanal                                │
│ ⟳ Opening Firefox...                   │  ← live status panel
│ ⟳ Waiting for login... (247s)          │
│ ✓ Session detected!                     │
│ ✓ Connected                            │
└─────────────────────────────────────────┘
```

### Job form — auto-upload toggle
```
Auto-upload to YouTube  [toggle]
// Disabled + tooltip "Connect account first" si account.connected=false
```

---

## 12. Variables de entorno (.env)

```env
DATABASE_URL=postgresql+asyncpg://mpv2:mpv2@localhost:5432/mpv2
REDIS_URL=redis://localhost:6379/0
FAL_KEY=your_fal_api_key
TAVILY_API_KEY=your_tavily_key        # opcional
OLLAMA_BASE_URL=http://localhost:11434
REMOTION_SERVICE_URL=http://localhost:3001
MP_DIR=.mp
CONFIG_PATH=config.json
```

---

## 13. Estado de implementación

```
✅ STEP 1  — Infraestructura base (PostgreSQL, Redis, Alembic, Docker)
✅ STEP 2  — Backend esqueleto (FastAPI, modelos, schemas)
✅ STEP 3  — Celery workers (youtube, twitter, remotion_generate)
✅ STEP 4  — API Routes completas + WebSocket jobs
✅ STEP 5  — Frontend base (React, Vite, Tailwind, useJobStream)
✅ STEP 6  — Frontend completo (YouTube, Twitter, Costs, Config, Dashboard)
✅ STEP 7  — Remotion microservice (4 templates, 3 resolutions, TTS audio)
✅ STEP 8  — Web search + duration control en YouTube pipeline

🔲 STEP 9  — Account connect flow (Firefox login → sesión en DB)
              Tasks: #1 DB migration, #2 connect endpoint,
                     #3 WebSocket canal accounts, #4 Frontend connect UI,
                     #5 upload_youtube step en worker, #6 auto-upload toggle

🔲 STEP 10 — Twitter connect + auto-post (mismo patrón que YouTube)
🔲 STEP 11 — Music library (tracks CC0 en remotion-service/assets/music/)
🔲 STEP 12 — CRON scheduling desde dashboard
🔲 STEP 13 — Docker Compose full-stack (un comando levanta todo)
```

---

## 14. Convenciones de código

### Backend (Python)
- Python 3.12+, type hints en todo
- `async/await` en routes y DB, sync en Celery tasks (usar psycopg2 driver)
- SQLAlchemy 2.0 style
- Pydantic v2 para schemas
- Sin comentarios obvios, solo el WHY

### Frontend (TypeScript)
- React functional components
- Custom hooks para lógica WebSocket
- Tailwind para estilos
- `cn()` para clases condicionales

### Celery tasks
- `bind=True` siempre (para retry)
- Publicar evento Redis al inicio y fin de cada step
- Registrar costo en `cost_records` después de cada API externa
- No silenciar excepciones — dejar fallar, registrar en DB

### Lo que NO tocar en `src/`
El código original funciona. Workers lo importan directamente:
```python
from llm_provider import generate_text
from classes.YouTube import YouTube   # para upload_video()
from classes.Twitter import Twitter   # para post()
```

---

## 15. Glosario

| Término | Definición |
|---|---|
| **Job** | Unidad de trabajo async (generar video, publicar tweet, etc.) |
| **Pipeline** | Secuencia ordenada de steps para completar un job |
| **Step** | Paso individual del pipeline (generate_script, generate_images, etc.) |
| **Account** | Cuenta de plataforma con perfil Firefox asociado |
| **Connect flow** | Proceso de abrir Firefox, esperar login manual, guardar sesión |
| **Profile** | Directorio Firefox con sesión activa (`~/.mp/profiles/{account_id}/`) |
| **Cost record** | Registro de una llamada a servicio externo con costo en USD |
| **Worker** | Proceso Celery que ejecuta jobs en background |
| **Event** | Mensaje Redis Pub/Sub emitido al cambiar estado de step o connect flow |
| **Bundle** | Webpack bundle de Remotion — se construye al arrancar remotion-service |
