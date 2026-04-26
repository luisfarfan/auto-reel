# Legacy CLI (src/)

## What It Is

The original MoneyPrinterV2 CLI, kept intact. Celery workers import from it directly.

## Why Not to Refactor

Workers depend on these specific imports:
```python
from llm_provider import generate_text      # used by all workers
from classes.YouTube import YouTube          # upload_video() in youtube worker
from classes.Twitter import Twitter          # post() in twitter worker
```

Renaming, moving, or restructuring any of these breaks the workers silently.

## Critical: Import Path Quirk

`python src/main.py` adds `src/` to `sys.path`. All files inside `src/` import with bare names:

```python
# Correct (inside src/)
from config import get_ollama_model
from cache import save_video
from classes.YouTube import YouTube

# Wrong — breaks at runtime
from src.config import get_ollama_model
```

Celery workers replicate this:
```python
import sys
sys.path.insert(0, "src")   # must be first line before any src/ import
```

## Key Modules

| File | Purpose |
|---|---|
| `src/main.py` | Interactive menu loop (also used for smoke testing) |
| `src/cron.py` | Headless: `python src/cron.py <platform> <account_uuid>` |
| `src/llm_provider.py` | `generate_text(prompt)` via Ollama Python SDK |
| `src/config.py` | 30+ getter functions; re-reads `config.json` on every call (no caching) |
| `src/cache.py` | JSON persistence in `.mp/` (legacy accounts, videos, posts) |
| `src/constants.py` | Selenium CSS/XPath selectors, menu strings |
| `src/classes/YouTube.py` | Full Shorts pipeline + `upload_video()` |
| `src/classes/Twitter.py` | Selenium automation: `post()` |
| `src/classes/AFM.py` | Amazon scraping + LLM pitch generation |
| `src/classes/Outreach.py` | Google Maps scraper + SMTP email (currently broken) |
| `src/classes/Tts.py` | edge-tts wrapper |

## config.py Behavior

Every getter re-reads `config.json` from disk:
```python
ROOT_DIR = os.path.dirname(sys.path[0])  # project root

def get_ollama_model():
    with open(os.path.join(ROOT_DIR, "config.json")) as f:
        return json.load(f)["ollama_model"]
```

This means hot-editing `config.json` takes effect on the next function call with no restart needed. But it also means no in-memory caching.

## Running the CLI

Must run from project root:
```bash
source venv/bin/activate
python src/main.py
```

## When to Touch src/

Only to fix a specific bug. Never for refactoring, renaming, or "cleanup". New features always go in `backend/`.
