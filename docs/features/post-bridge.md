# Post Bridge Integration

Optional cross-posting to TikTok and Instagram after a successful YouTube upload.

## What It Does

1. Looks up connected Post Bridge accounts
2. Requests signed upload URL
3. Uploads the generated video asset
4. Creates a post for selected TikTok/Instagram accounts

MoneyPrinterV2 owns video generation + YouTube upload. Post Bridge only runs after YouTube succeeds.

## Setup

1. Create account at Post Bridge
2. Connect TikTok/Instagram accounts
3. Generate API key
4. Add to `config.json` or set `POST_BRIDGE_API_KEY` env var

```json
{
  "post_bridge": {
    "enabled": true,
    "api_key": "pb_your_api_key_here",
    "platforms": ["tiktok", "instagram"],
    "account_ids": [],
    "auto_crosspost": false
  }
}
```

## Config Keys

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `false` | Enable integration |
| `api_key` | string | `""` | Falls back to `POST_BRIDGE_API_KEY` env var |
| `platforms` | string[] | `["tiktok","instagram"]` | Platform filter for account lookup |
| `account_ids` | number[] | `[]` | Fixed account IDs — skips interactive lookup |
| `auto_crosspost` | bool | `false` | Auto cross-post without prompting |

## Behavior by Mode

**Interactive (`python src/main.py`):**
- `enabled=true`, `auto_crosspost=false` → asks after successful YouTube upload
- `account_ids` empty → fetches accounts, prompts selection if multiple
- After selection, prints chosen IDs (copy to `config.json` for cron use)

**Cron (`python src/cron.py`):**
- `auto_crosspost=false` → skips, logs reason
- `auto_crosspost=true` → cross-posts automatically
- `account_ids` empty + multiple accounts → skips (can't prompt)

## Caveats (v1)

- YouTube title used as caption on all platforms
- TikTok gets YouTube title as `title` override
- Instagram cover-image customization not included
- No pagination handling for >100 Post Bridge accounts

## Troubleshooting

| Issue | Fix |
|---|---|
| Cross-post prompt never appears | Set `post_bridge.enabled = true` |
| Skipped in cron | Set `auto_crosspost = true` |
| No accounts found | Check accounts are connected in Post Bridge; verify `platforms` matches |
| Cron skips with multiple accounts | Add `account_ids` to config |
| API key ignored | Set `post_bridge.api_key` or export `POST_BRIDGE_API_KEY` |
