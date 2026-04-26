# Troubleshooting

## Firefox won't open — `Process unexpectedly closed with status 0`

### Symptoms

- Selenium throws `WebDriverException: Message: Process unexpectedly closed with status 0`
- geckodriver log: `Sandbox: CanCreateUserNamespace() unshare(CLONE_NEWPID): EPERM`
- Firefox exits immediately with code 1, no window appears

### Root Causes (Ubuntu 24.04, dual-GPU NVIDIA + AMD)

**Cause 1: Stale lock file**
```bash
pkill -9 firefox
find ~/.mozilla/firefox -name ".parentlock" -delete
find ~/.mozilla/firefox -name "lock" -delete
```

**Cause 2: Firefox crashes on NVIDIA GPU**

Force AMD integrated GPU:
```bash
DRI_PRIME=1 firefox
```

Permanent (add to `~/.profile`):
```bash
export DRI_PRIME=1
```

**Cause 3: AppArmor blocks DBus calls**

Disable Firefox AppArmor profile:
```bash
sudo apparmor_parser -R /etc/apparmor.d/firefox
sudo apparmor_parser -R /etc/apparmor.d/usr.bin.firefox
```

**Cause 4: Kernel restricts unprivileged user namespaces**
```bash
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0

# Persist across reboots:
echo 'kernel.apparmor_restrict_unprivileged_userns=0' | sudo tee /etc/sysctl.d/99-userns.conf
```

### Full Fix Sequence (Ubuntu 24.04)

```bash
# Kill zombie Firefox
pkill -9 firefox
find ~/.mozilla/firefox -name ".parentlock" -delete

# Unlock kernel user namespaces
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0

# Remove AppArmor Firefox profile
sudo apparmor_parser -R /etc/apparmor.d/firefox 2>/dev/null || true
sudo apparmor_parser -R /etc/apparmor.d/usr.bin.firefox 2>/dev/null || true

# Launch Firefox with AMD GPU
DRI_PRIME=1 firefox
```

### How It's Fixed in Code

All Selenium driver setups (`YouTube.py`, `Twitter.py`, `AFM.py`, `backend/routes/accounts.py`) pass:

```python
_svc_env = os.environ.copy()
_svc_env.setdefault("DISPLAY", ":0")
_svc_env.setdefault("DRI_PRIME", "1")
self.service = Service(GeckoDriverManager().install(), env=_svc_env)
```

> **Do not set `MOZ_DISABLE_CONTENT_SANDBOX=1`** — disables security sandbox, sites detect it.

---

## Firefox profile path not found

**Error:** `ValueError: Firefox profile path does not exist or is not a directory`

Profile was moved or deleted.

**Fix:** Re-run account connect flow from dashboard to capture a new session.

---

## Remotion render fails

**Symptom:** `Error: Cannot find bundle` or blank video output.

**Fix:** Restart `remotion-service`. Bundle builds once at startup — if it failed, the cached bundle is invalid.

```bash
cd remotion-service && npm run dev
```

Wait for `Bundle ready` log before triggering a render.

---

## Celery task stuck in `pending`

Worker not running or wrong queue.

```bash
# Check worker is up
celery -A backend.workers.celery_app inspect active

# Restart with all queues
celery -A backend.workers.celery_app worker -Q remotion,youtube,twitter -c 1
```

---

## ImageMagick error in MoviePy

**Error:** `OSError: cannot convert 'magick'` or subtitle rendering fails.

Set correct path in `config.json`:
```json
{ "imagemagick_path": "/usr/bin/convert" }
```

Verify: `which convert` on Linux/macOS, `where magick` on Windows.

---

## fal.ai rate limit / 429

fal.ai FLUX schnell has rate limits on free tier. Retry after 60s or upgrade plan.

Check `FAL_KEY` in `.env` is correct.
