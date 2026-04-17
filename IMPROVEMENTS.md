# MoneyPrinterV2 — Plan de Mejoras

> Roadmap priorizado para escalar el proyecto de CLI local a plataforma de generación de contenido AI.

---

## Estado actual (baseline)

| Componente | Estado |
|---|---|
| LLM (Ollama) | ✅ funciona |
| TTS (KittenTTS) | ✅ funciona |
| Subtítulos (Whisper local) | ✅ funciona |
| Video compose (MoviePy) | ✅ funciona |
| Image gen (Gemini/NanoBanana2) | ⚠️ requiere API key |
| Upload YouTube (Selenium) | ⚠️ frágil, requiere Firefox logueado |
| Post Twitter (Selenium) | ⚠️ frágil, requiere Firefox logueado |
| Outreach (Google Maps scraper) | ❌ roto (scraper v0.9.7 desactualizado) |
| Web UI | ❌ no existe |
| Base de datos | ❌ JSON files sin locking |
| Tests | ⚠️ solo cubre PostBridge |

---

## FASE 1 — Estabilizar el core (1-2 semanas)

### TASK-01: Integrar FAL.AI para generación de imágenes

**Problema:** NanoBanana2/Gemini es el único proveedor. Sin API key, no hay imágenes.
**Solución:** Agregar FAL.AI como proveedor primario (mejor calidad, más modelos).

**Archivos a modificar:**
- `src/classes/YouTube.py` — agregar `generate_image_fal()`
- `config.json` / `config.example.json` — agregar `fal_api_key`, `fal_model`
- `src/config.py` — agregar getters `get_fal_api_key()`, `get_fal_model()`
- `requirements.txt` — agregar `fal-client`

**Claude Code skills:**
```bash
# Después de implementar:
/simplify          # revisar que no haya código redundante
/review            # code review del cambio
/security-review   # verificar que API key no se loguee
```

**Modelos recomendados FAL:**
- `fal-ai/flux/schnell` — rápido y barato (~$0.003/imagen)
- `fal-ai/flux/dev` — mejor calidad (~$0.025/imagen)
- `fal-ai/fast-sdxl` — alternativa rápida

---

### TASK-02: Descargar música de fondo automáticamente

**Problema:** El pipeline falla si no hay archivos en `Songs/`. `fetch_songs()` existe pero requiere `zip_url` en config.
**Solución:** Agregar URL de música libre de derechos por defecto + fallback a silencio.

**Archivos a modificar:**
- `src/utils.py` — modificar `choose_random_song()` para no fallar si Songs/ vacío
- `config.example.json` — agregar `zip_url` con música libre de derechos

**Claude Code skills:**
```bash
/simplify          # después de modificar utils.py
```

---

### TASK-03: Reemplazar Selenium upload por YouTube Data API oficial

**Problema:** Selenium es frágil. YouTube cambia su UI → todo se rompe.
**Solución:** Usar YouTube Data API v3 (OAuth2). Más estable, no requiere browser.

**Archivos a modificar:**
- `src/classes/YouTube.py` — reemplazar `upload_video()` con llamadas a YouTube Data API
- `config.json` — agregar `youtube_client_id`, `youtube_client_secret`
- `requirements.txt` — agregar `google-api-python-client`, `google-auth-oauthlib`

**Ventajas:**
- No necesita Firefox ni perfil pre-logueado
- No se rompe con cambios de UI
- Soporta multi-cuenta con tokens OAuth
- Puede correr headless en servidor

**Claude Code skills:**
```bash
/security-review   # OAuth tokens deben guardarse seguro, no en config.json
/review            # revisar flujo de autenticación
```

---

### TASK-04: Arreglar Outreach (Google Maps scraper)

**Problema:** v0.9.7 roto, v1.12.0 cambió a web server.
**Solución:** Actualizar `Outreach.py` para usar v1.12.0 (nueva API con web UI + CLI mode).

**Archivos a modificar:**
- `src/classes/Outreach.py` — actualizar URL de descarga, adaptar flags del binario
- `config.json` — actualizar `google_maps_scraper` URL a v1.12.0

**Claude Code skills:**
```bash
/simplify          # después de refactor
/review            # verificar manejo de errores
```

---

### TASK-05: Agregar manejo de errores robusto

**Problema:** Excepciones silenciosas. Browser no se cierra si falla.
**Solución:** Wrappear pipelines en try/finally, agregar reintentos, logging estructurado.

**Archivos a modificar:**
- `src/classes/YouTube.py` — try/finally en `upload_video()`, `combine()`
- `src/classes/Twitter.py` — try/finally en `post()`
- `src/classes/AFM.py` — try/finally en `scrape_product_information()`

**Claude Code skills:**
```bash
/review            # revisar todos los flujos de error
/security-review   # verificar que errores no expongan credenciales en logs
```

---

## FASE 2 — Web Dashboard (2-4 semanas)

### TASK-06: Backend FastAPI

**Problema:** Solo existe CLI interactivo. No se puede usar remotamente ni escalar.
**Solución:** API REST con FastAPI que exponga todos los flujos actuales.

**Estructura nueva:**
```
src/
  api/
    main.py          # FastAPI app
    routes/
      youtube.py     # /youtube/generate, /youtube/upload, /youtube/accounts
      twitter.py     # /twitter/post, /twitter/accounts
      outreach.py    # /outreach/start
      config.py      # /config/get, /config/update
    models/
      schemas.py     # Pydantic models
```

**Endpoints principales:**
- `POST /youtube/generate` — genera video completo, retorna path MP4
- `POST /youtube/upload` — sube video a YouTube
- `GET /youtube/accounts` — lista cuentas
- `POST /twitter/post` — genera y postea tweet
- `GET /jobs/{job_id}` — estado de job en curso

**Claude Code skills:**
```bash
/review            # revisar API design
/security-review   # autenticación, rate limiting
```

---

### TASK-07: Jobs asíncronos con Celery + Redis

**Problema:** Generar un video tarda 2-5 minutos. En una API sincrónica bloquea todo.
**Solución:** Celery workers + Redis como broker.

**Archivos nuevos:**
- `src/workers/celery_app.py`
- `src/workers/tasks.py` — `generate_video_task()`, `post_twitter_task()`

**Flujo:**
```
POST /youtube/generate → retorna job_id inmediato
GET /jobs/{job_id}     → retorna status: pending/running/done/failed + resultado
```

**Claude Code skills:**
```bash
/review            # revisar task definitions
```

---

### TASK-08: Frontend React

**Problema:** No hay UI. Solo CLI.
**Solución:** React SPA con dashboard de control.

**Páginas:**
- `/` — Dashboard: jobs en curso, últimos videos, stats
- `/youtube` — Crear video: niche, idioma, voz, modelo → botón generar → preview
- `/twitter` — Crear tweet: topic → preview → publicar
- `/accounts` — Gestión de cuentas YouTube/Twitter
- `/config` — Editor de configuración
- `/scheduler` — Configurar CRON jobs por cuenta

**Stack:**
- React + Vite
- Tailwind CSS
- React Query (para polling de jobs)
- shadcn/ui (componentes)

**Claude Code skills:**
```bash
/review            # revisar componentes
/simplify          # reducir código duplicado en componentes
```

---

### TASK-09: Autenticación OAuth en UI

**Problema:** Login a YouTube/Twitter requiere Firefox con perfil. No funciona en servidor.
**Solución:** Flujo OAuth en el dashboard web.

**Para YouTube:**
1. Botón "Conectar YouTube" → abre Google OAuth
2. Token guardado en DB por cuenta
3. YouTube Data API usa el token

**Para Twitter:**
- Twitter API v2 con OAuth 1.0a o 2.0 (reemplaza Selenium completamente)

**Archivos nuevos:**
- `src/api/routes/auth.py`
- `src/db/models/token.py`

---

## FASE 3 — Base de datos y escalabilidad (3-6 semanas)

### TASK-10: Migrar de JSON files a PostgreSQL

**Problema:** JSON files sin locking atómico. No escala con múltiples workers/usuarios.
**Solución:** PostgreSQL + SQLAlchemy ORM.

**Schema:**
```sql
accounts (id, provider, nickname, oauth_token, created_at)
videos (id, account_id, title, description, url, niche, language, created_at)
posts (id, account_id, content, platform, created_at)
jobs (id, type, status, payload, result, created_at, updated_at)
config (key, value, updated_at)
```

**Archivos a modificar/crear:**
- `src/db/models.py` — SQLAlchemy models
- `src/db/session.py` — DB connection
- `src/cache.py` — reemplazar con DB queries
- `alembic/` — migraciones

**Claude Code skills:**
```bash
/security-review   # verificar SQL injection, credenciales en env vars
/review            # revisar schema y migrations
```

---

### TASK-11: Sistema multi-usuario

**Problema:** Todos los datos son globales. No hay concepto de "usuario".
**Solución:** Agregar users table + JWT authentication.

**Archivos nuevos:**
- `src/api/routes/auth.py` — register, login, refresh token
- `src/db/models/user.py`

**Claude Code skills:**
```bash
/security-review   # JWT, password hashing, rate limiting en auth
```

---

### TASK-12: Multi-cuenta con pool de browsers anti-detección

**Problema:** Un Firefox, una cuenta. Fácil de detectar.
**Solución:** Playwright + Camoufox + pool de cuentas rotando.

**Archivos a modificar:**
- `src/classes/YouTube.py` — reemplazar Selenium con Playwright
- `src/classes/Twitter.py` — reemplazar Selenium con Playwright
- `requirements.txt` — agregar `playwright`, `camoufox`

**Anti-detección:**
- Fingerprint spoofing con Camoufox
- Delays aleatorios con distribución humana
- Rotación de User-Agents
- Proxies rotativos (configurables)

**Claude Code skills:**
```bash
/security-review   # verificar que proxies estén bien configurados
/review            # revisar implementación anti-detección
```

---

## FASE 4 — Calidad de contenido (continuo)

### TASK-13: Mejorar pipeline de video

**Mejoras concretas:**
- Transiciones entre imágenes (fade, zoom, slide)
- Ken Burns effect en imágenes estáticas
- Overlay de logo/watermark opcional
- Múltiples formatos: 9:16 (Shorts), 16:9 (YouTube largo), 1:1 (Instagram)
- Thumbnails automáticos

**Archivos a modificar:**
- `src/classes/YouTube.py` → método `combine()`

**Claude Code skills:**
```bash
/simplify          # combine() es complejo, simplificar
/review            # revisar pipeline de composición
```

---

### TASK-14: LLM mejorado con Claude API

**Problema:** Ollama local es lento y limita la calidad del script.
**Solución:** Agregar Claude API como proveedor LLM opcional.

**Archivos a modificar:**
- `src/llm_provider.py` — agregar `generate_text_claude()`
- `config.json` — agregar `llm_provider: "ollama" | "claude"`, `anthropic_api_key`
- `requirements.txt` — agregar `anthropic`

**Claude Code skills:**
```bash
/claude-api        # skill específico para integración con Claude API + prompt caching
/review            # revisar implementación
```

---

### TASK-15: TTS mejorado

**Problema:** KittenTTS tiene voz robótica.
**Solución:** Agregar proveedores de TTS de mayor calidad.

**Opciones:**
- ElevenLabs — voces ultra-realistas, $5/mes
- OpenAI TTS — buena calidad, $0.015/1K chars
- Kokoro (local, open source) — mejor que KittenTTS, gratis

**Archivos a modificar:**
- `src/classes/Tts.py` — agregar providers
- `config.json` — `tts_provider: "kittentts" | "elevenlabs" | "openai" | "kokoro"`

**Claude Code skills:**
```bash
/simplify          # Tts.py es muy simple, puede necesitar refactor para multi-provider
```

---

### TASK-16: Analytics y reportes

**Qué trackear:**
- Views, likes, comentarios por video (YouTube Analytics API)
- Engagement por tweet
- Best performing niches
- Costo por video generado (tokens LLM + imagen API)

**Archivos nuevos:**
- `src/analytics/youtube_analytics.py`
- `src/analytics/twitter_analytics.py`

---

## FASE 5 — DevOps y deploy (2-3 semanas)

### TASK-17: Dockerizar el proyecto

**Archivos nuevos:**
```
Dockerfile
docker-compose.yml    # app + postgres + redis + celery worker
.env.example
```

**Claude Code skills:**
```bash
/security-review   # verificar secrets no en imagen Docker
```

---

### TASK-18: CI/CD con GitHub Actions

**Archivos nuevos:**
```
.github/workflows/
  test.yml          # run tests on PR
  deploy.yml        # deploy on merge to main
```

**Tests a agregar:**
- Tests unitarios para todo el pipeline de generación
- Tests de integración para API endpoints
- Tests de humo post-deploy

**Claude Code skills:**
```bash
/review            # revisar workflows
```

---

### TASK-19: Observabilidad

**Stack:**
- Logs estructurados (JSON) → reemplazar `status.py` con `structlog`
- Métricas → Prometheus + Grafana
- Alertas → cuando job falla N veces consecutivas

---

## Orden de implementación recomendado

```
AHORA:
  TASK-01 → FAL.AI images          (30 min)
  TASK-02 → Música automática      (20 min)
  TASK-05 → Error handling         (1-2h)

SEMANA 1-2:
  TASK-03 → YouTube Data API       (2-3 días)
  TASK-04 → Fix Outreach           (1 día)

SEMANA 3-4:
  TASK-06 → FastAPI backend        (3-4 días)
  TASK-07 → Celery + Redis         (1-2 días)
  TASK-08 → React frontend         (1 semana)

SEMANA 5-6:
  TASK-09 → OAuth en UI            (2-3 días)
  TASK-10 → PostgreSQL             (2-3 días)
  TASK-14 → Claude API LLM        (1 día)

SEMANA 7-8:
  TASK-13 → Video quality          (2-3 días)
  TASK-15 → TTS mejorado           (1-2 días)
  TASK-17 → Docker                 (1 día)
  TASK-18 → CI/CD                  (1 día)

ONGOING:
  TASK-12 → Anti-detección         (continuo)
  TASK-16 → Analytics              (continuo)
  TASK-19 → Observabilidad         (continuo)
```

---

## Skills de Claude Code más útiles para este proyecto

| Skill | Cuándo usarlo |
|---|---|
| `/simplify` | Después de cada implementación — detecta código redundante |
| `/review` | Antes de cada commit importante — code review automático |
| `/security-review` | En cualquier cambio que toque API keys, OAuth, DB, browser automation |
| `/claude-api` | Al integrar Claude API como LLM provider (TASK-14) |
| `/caveman` | Para respuestas concisas mientras trabajás |

---

## Costo estimado mensual (a escala)

| Servicio | Costo |
|---|---|
| FAL.AI FLUX schnell (5 imgs/video × 30 videos) | ~$4.50 |
| ElevenLabs TTS (30 videos) | ~$5 |
| VPS (4 cores, 8GB RAM) | ~$20-40 |
| Proxies residenciales (si se necesitan) | ~$50-100 |
| PostgreSQL managed (pequeño) | ~$10 |
| **Total** | **~$90-160/mes** |

Con YouTube Data API oficial, se elimina la necesidad de proxies para upload.
