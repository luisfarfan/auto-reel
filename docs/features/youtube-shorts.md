# YouTube Shorts Pipeline (MoviePy)

Generate, compose, and upload YouTube Shorts. Triggered from dashboard → YouTube page.
Celery task: `youtube.generate_video`.

## Pipeline Steps

| # | Step | Service |
|---|---|---|
| 1 | Web Search (optional) | Tavily API |
| 2 | Generate Script | Ollama |
| 3 | Generate Metadata (title + description) | Ollama |
| 4 | Generate Image Prompts | Ollama |
| 5 | Generate Images | fal.ai FLUX schnell |
| 6 | Synthesize Voice | edge-tts |
| 7 | Generate Subtitles | faster-whisper |
| 8 | MoviePy Compose | local |
| 9 | Selenium Upload | Firefox |
| 10 | Post Bridge cross-post (optional) | Post Bridge API |

## Key Code

`src/classes/YouTube.py` — full pipeline class. Workers call:
- `YouTube.generate_video()` — runs steps 1–8
- `YouTube.upload_video()` — runs step 9 (Selenium)

## Account Connect Flow

Accounts use pre-authenticated Firefox profiles (no passwords stored).

1. Dashboard → YouTube page → "Connect Account" button
2. Backend opens Firefox with a fresh profile
3. User logs in to YouTube manually
4. Backend detects active session → saves profile path in `accounts.firefox_profile_path`
5. `accounts.connected = true`

WebSocket channel `account:{account_id}` streams status to UI.
Frontend hook: `useAccountStream`.

## Auto-Upload

If account is connected, auto-upload toggle is available. When enabled:
- After MoviePy compose, Selenium loads the saved Firefox profile
- Navigates to YouTube Studio → Upload flow
- Fills title + description from generated metadata
- Sets `is_for_kids` from `config.json`

## Configuration (config.json)

```json
{
  "firefox_profile": "/path/to/profile",   // default profile (overridden per-account)
  "headless": false,                        // false required for Selenium upload
  "is_for_kids": false,
  "ollama_model": "llama3.2:3b",
  "threads": 2,
  "imagemagick_path": "/usr/bin/convert",
  "tts_voice": "Jasper",
  "whisper_model": "base",
  "whisper_device": "auto"
}
```

## Post Bridge (Cross-posting)

After a successful upload, optionally cross-post to TikTok/Instagram via Post Bridge API.
See [post-bridge.md](post-bridge.md) for full setup.

## Troubleshooting

Firefox not opening → [../guides/troubleshooting.md](../guides/troubleshooting.md)

Profile path missing → Re-run connect flow from dashboard.
