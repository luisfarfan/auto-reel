# Troubleshooting

Known issues and their solutions.

---

## Firefox won't open — `Process unexpectedly closed with status 0`

### Symptoms

- Selenium throws `WebDriverException: Message: Process unexpectedly closed with status 0`
- geckodriver log shows `Sandbox: CanCreateUserNamespace() unshare(CLONE_NEWPID): EPERM`
- Opening Firefox manually shows: *"Firefox is already running, but is not responding"*
- Firefox exits immediately with code 1, no window appears

### Root Causes

This combination of errors on Ubuntu 24.04 with a dual-GPU laptop (NVIDIA + AMD) has **two separate causes** that both need to be fixed:

#### 1. Stale Firefox lock file (zombie process)

Previous Firefox/Selenium sessions that crashed leave a lock file behind. Firefox refuses to start a second instance.

**Fix:**
```bash
pkill -9 firefox
find ~/.mozilla/firefox -name ".parentlock" -delete
find ~/.mozilla/firefox -name "lock" -delete
```

#### 2. Firefox tries to use NVIDIA GPU and crashes

On dual-GPU systems (NVIDIA discrete + AMD/Intel integrated), Firefox defaults to the NVIDIA GPU. On Ubuntu 24.04 with certain NVIDIA driver configurations, this causes an immediate silent crash.

**Symptom:** `ATTENTION: default value of option mesa_glthread overridden by environment` followed by exit code 1.

**Fix — force AMD integrated GPU:**
```bash
DRI_PRIME=1 firefox
```

To make this permanent, add to `~/.profile`:
```bash
export DRI_PRIME=1
```

#### 3. AppArmor blocks DBus calls (Ubuntu 24.04)

Ubuntu 24.04 ships with a strict AppArmor profile for Firefox that blocks certain DBus method calls Firefox needs at startup.

**Symptom in journalctl:**
```
apparmor="DENIED" operation="dbus_method_call" ... label="firefox"
```

**Fix — disable Firefox AppArmor profile:**
```bash
sudo apparmor_parser -R /etc/apparmor.d/firefox
sudo apparmor_parser -R /etc/apparmor.d/usr.bin.firefox
```

#### 4. Kernel restricts unprivileged user namespaces

Ubuntu 24.04 sets `kernel.apparmor_restrict_unprivileged_userns=1` by default. Firefox's sandbox needs user namespaces.

**Fix:**
```bash
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
```

To persist across reboots:
```bash
echo 'kernel.apparmor_restrict_unprivileged_userns=0' | sudo tee /etc/sysctl.d/99-userns.conf
```

### Full Fix Sequence (Ubuntu 24.04, dual-GPU NVIDIA + AMD)

Run these in order:

```bash
# 1. Kill zombie Firefox
pkill -9 firefox
find ~/.mozilla/firefox -name ".parentlock" -delete

# 2. Unlock kernel user namespaces
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0

# 3. Remove AppArmor Firefox profile
sudo apparmor_parser -R /etc/apparmor.d/firefox 2>/dev/null || true
sudo apparmor_parser -R /etc/apparmor.d/usr.bin.firefox 2>/dev/null || true

# 4. Launch Firefox with AMD GPU
DRI_PRIME=1 firefox
```

### How This Is Fixed in the Code

All three Selenium driver setups (`YouTube.py`, `Twitter.py`, `AFM.py`, `accounts.py`) now explicitly pass the correct environment to geckodriver:

```python
_svc_env = os.environ.copy()
_svc_env.setdefault("DISPLAY", ":0")
_svc_env.setdefault("DRI_PRIME", "1")
self.service = Service(GeckoDriverManager().install(), env=_svc_env)
```

`DRI_PRIME=1` forces the AMD integrated GPU. Without this, geckodriver inherits the system default which selects NVIDIA and crashes.

> **Do not set `MOZ_DISABLE_CONTENT_SANDBOX=1`.** It makes Firefox work but disables the security sandbox — YouTube and other sites detect this and show security warnings.

---

## Firefox profile path not found

**Error:** `ValueError: Firefox profile path does not exist or is not a directory`

Profile path stored in the account cache no longer exists (profile was moved or deleted).

**Fix:** Re-run the account connect flow from the dashboard to capture a new Firefox session.
