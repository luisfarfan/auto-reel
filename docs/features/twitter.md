# Twitter/X Bot

Automate tweet generation and posting. Celery task: `twitter.post_tweet`.

## How It Works

1. Select Twitter account from dashboard
2. Provide topic (or let LLM pick from account niche)
3. Celery worker:
   - Calls `generate_text(prompt)` via Ollama to write the tweet
   - Opens Firefox with account's saved profile
   - Navigates to x.com → compose tweet → post
4. Result saved in `posts` table

## Key Code

`src/classes/Twitter.py` — `post(text)` method uses Selenium against x.com.
`backend/workers/twitter.py` — Celery task, calls `Twitter.post()`.

## Account Connect Flow

Same pattern as YouTube:
1. Dashboard → Twitter page → Connect Account
2. Firefox opens → user logs in to x.com
3. Session saved as Firefox profile per account
4. `accounts.connected = true`

WebSocket channel: `account:{account_id}` → status updates to `useAccountStream` hook.

## Configuration (config.json)

```json
{
  "twitter_language": "English",
  "headless": false,
  "ollama_model": "llama3.2:3b",
  "firefox_profile": "/path/to/profile"   // overridden per-account
}
```

`headless: false` required — x.com detects headless Chromium/Firefox.

## Selenium Selectors

CSS/XPath selectors for x.com are in `src/constants.py`.
x.com updates its DOM frequently — if posting breaks, update selectors there.

## Troubleshooting

Firefox issues → [../guides/troubleshooting.md](../guides/troubleshooting.md)

Tweet fails silently → Check `src/constants.py` selectors against current x.com DOM.
