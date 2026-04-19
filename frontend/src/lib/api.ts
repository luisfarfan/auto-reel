const BASE = "/api"

export interface Job {
  id: string
  type: string
  status: "pending" | "running" | "done" | "failed" | "cancelled"
  account_id: string | null
  celery_task_id: string | null
  input: Record<string, unknown> | null
  result: Record<string, unknown> | null
  error: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface PipelineStep {
  step: string
  status: "pending" | "running" | "done" | "failed" | "skipped"
  detail: string | null
  started_at: string | null
  finished_at: string | null
  meta: Record<string, unknown> | null
}

export interface Account {
  id: string
  platform: "youtube" | "twitter"
  nickname: string
  niche: string | null
  language: string | null
  topic: string | null
  firefox_profile_path: string | null
  connected: boolean
  last_connected_at: string | null
  created_at: string
}

export interface CostSummary {
  daily_usd: number
  monthly_usd: number
  total_usd: number
}

export interface BudgetConfig {
  daily_limit_usd: number
  monthly_limit_usd: number
  alert_threshold: number
}

export interface VideoRecord {
  id: string
  job_id: string | null
  title: string | null
  file_path: string | null
  youtube_url: string | null
  duration_seconds: number | null
  file_size_bytes: number | null
  created_at: string
}

export interface CostByService {
  service: string
  total_usd: number
  count: number
}

export interface CostByJob {
  job_id: string
  total_usd: number
  created_at: string
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text || `${res.status}`)
  }
  return res.json() as Promise<T>
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export const api = {
  jobs: {
    list: (params?: { status?: string; type?: string }) => {
      const q = new URLSearchParams(
        Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null)) as Record<string, string>
      ).toString()
      return get<Job[]>(`/jobs${q ? `?${q}` : ""}`)
    },
    get: (id: string) => get<Job>(`/jobs/${id}`),
    steps: (id: string) => get<PipelineStep[]>(`/jobs/${id}/steps`),
    createYoutube: (body: {
      account_id: string
      niche: string
      topic?: string
      language: string
      web_search_enabled?: boolean
      duration_hint?: string
      auto_upload?: boolean
    }) => post<{ job_id: string; status: string }>("/jobs/youtube/generate", body),
    createTwitter: (body: { account_id: string; topic: string }) =>
      post<{ job_id: string; status: string }>("/jobs/twitter/post", body),
    createRemotion: (body: {
      account_id: string
      topic: string
      language?: string
      template?: string
      resolution?: string
      web_search_enabled?: boolean
      model?: string
      music_track?: string | null
      duration_hint?: string
    }) => post<{ job_id: string; status: string }>("/jobs/remotion/generate", body),
    cancel: (id: string) => del<{ status: string }>(`/jobs/${id}`),
    uploadToYoutube: (id: string) => post<{ job_id: string; status: string; task_id: string }>(`/jobs/${id}/upload`, {}),
  },
  videos: {
    list: () => get<VideoRecord[]>("/videos"),
    byJob: (jobId: string) => get<VideoRecord>(`/videos/by-job/${jobId}`),
    getById: (videoId: string) => get<VideoRecord>(`/videos/${videoId}`),
  },
  accounts: {
    list: (platform?: "youtube" | "twitter") =>
      get<Account[]>(`/accounts${platform ? `?platform=${platform}` : ""}`),
    create: (body: Partial<Account>) => post<Account>("/accounts", body),
    delete: (id: string) => del<{ deleted: string }>(`/accounts/${id}`),
    connect: (id: string) => post<{ status: string; message: string }>(`/accounts/${id}/connect`, {}),
    connectStatus: (id: string) => get<{ status: string; message: string }>(`/accounts/${id}/connect/status`),
  },
  costs: {
    summary: () => get<CostSummary>("/costs"),
    budget: () => get<BudgetConfig>("/costs/budget"),
    updateBudget: (body: BudgetConfig) => put<BudgetConfig>("/costs/budget", body),
    byService: () => get<CostByService[]>("/costs/by-service"),
    byJob: () => get<CostByJob[]>("/costs/by-job"),
  },
  config: {
    get: () => get<Record<string, unknown>>("/config"),
    patch: (body: Record<string, unknown>) => patch<Record<string, unknown>>("/config", body),
  },
}
