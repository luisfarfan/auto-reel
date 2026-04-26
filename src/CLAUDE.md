# src/ — Claude Code Guide

Legacy CLI. Original MoneyPrinterV2 codebase. **Do not refactor.**

## Why Not to Touch

Celery workers import directly from here:
```python
from llm_provider import generate_text      # all workers
from classes.YouTube import YouTube          # youtube worker → upload_video()
from classes.Twitter import Twitter          # twitter worker → post()
```

Renaming, moving, or restructuring any of these breaks workers silently.

## Critical: Import Path

`python src/main.py` adds `src/` to `sys.path`. All code inside `src/` uses bare imports:

```python
# Correct
from config import get_ollama_model
from cache import save_video

# Wrong — breaks at runtime
from src.config import get_ollama_model
```

Workers replicate this with `sys.path.insert(0, "src")` before any import.

## Key Files

| File | What It Does | When Workers Use It |
|---|---|---|
| `llm_provider.py` | `generate_text(prompt)` via Ollama SDK | All pipelines |
| `config.py` | 30+ getters, each re-reads `config.json` (no cache) | All pipelines |
| `cache.py` | JSON persistence in `.mp/` (legacy) | Legacy CLI only |
| `constants.py` | Selenium selectors for YouTube, x.com, Amazon | YouTube + Twitter |
| `classes/YouTube.py` | Full Shorts pipeline + `upload_video()` | youtube worker |
| `classes/Twitter.py` | `post()` Selenium automation | twitter worker |
| `classes/Tts.py` | edge-tts wrapper | YouTube pipeline |
| `classes/AFM.py` | Amazon scraping + LLM pitch | Legacy CLI only |
| `classes/Outreach.py` | Google Maps + SMTP (broken) | Legacy CLI only |
| `main.py` | Interactive menu loop | Smoke testing |
| `cron.py` | Headless: `python src/cron.py <platform> <uuid>` | Legacy scheduler |

## config.py Behavior

Every getter re-reads `config.json` from disk on every call. No in-memory cache.
`ROOT_DIR` = `os.path.dirname(sys.path[0])` = project root.

## When to Modify

Only to fix a specific bug that affects worker functionality. Never for refactoring.
New features always go in `backend/`.

Full explanation → [../docs/architecture/legacy-cli.md](../docs/architecture/legacy-cli.md)
