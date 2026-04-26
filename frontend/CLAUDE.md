# frontend/ — Claude Code Guide

React 18 SPA. Vite + TypeScript + Tailwind + shadcn/ui.

## Structure

```
frontend/src/
  pages/
    Dashboard.tsx     Active jobs, stats, recent activity
    YouTube.tsx       Create Shorts + account management + connect flow
    Twitter.tsx       Create tweets + account management
    TechVideo.tsx     Remotion pipeline + video player
    Costs.tsx         Budget tracker, cost per service
    Config.tsx        config.json editor
  components/
    PipelineView.tsx  Real-time pipeline step display
    VideoPreview.tsx  HTML5 player with controls
    ConnectStatus.tsx Live status for account connect flow
  hooks/
    useJobStream.ts       WebSocket — job pipeline progress
    useAccountStream.ts   WebSocket — account connect flow status
  lib/
    api.ts            Typed fetch client for all backend calls
```

## Key Rules

**Functional components only** — no class components.

**WebSocket hooks:**
```typescript
// Job pipeline progress (channel: job:{jobId})
const { steps, status, totalCost, isDone } = useJobStream(jobId)

// Account connect status (channel: account:{accountId})
const { status, message, isConnecting } = useAccountStream(accountId)
// status: "idle"|"opening"|"waiting"|"detected"|"saving"|"connected"|"timeout"|"failed"
```

**Conditional classes via `cn()`:**
```typescript
import { cn } from "@/lib/utils"
<div className={cn("base", { "active": isActive, "error": hasError })} />
```

**API calls via `lib/api.ts`** — never raw fetch in components.

## Dev Commands

```bash
npm run dev    # port 5173
npm run build  # production build
npm run lint
```

## Backend API

Base URL: `http://localhost:8000/api`

Key endpoints:
- `POST /api/jobs` — create job
- `GET /api/jobs/{id}` — job status + steps
- `GET /api/accounts` — list accounts
- `POST /api/accounts/{id}/connect` — start connect flow
- `GET /api/videos` — list generated videos
- `GET /api/costs` — cost records

WebSocket: `ws://localhost:8000/ws/jobs/{id}` and `ws://localhost:8000/ws/accounts/{id}`

Full event schema → [../docs/architecture/websocket.md](../docs/architecture/websocket.md)
