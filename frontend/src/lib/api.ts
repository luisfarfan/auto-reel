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
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export const api = {
  jobs: {
    list: (params?: { status?: string; type?: string }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString()
      return get<Job[]>(`/jobs${q ? `?${q}` : ""}`)
    },
    get: (id: string) => get<Job>(`/jobs/${id}`),
    steps: (id: string) => get<PipelineStep[]>(`/jobs/${id}/steps`),
    createYoutube: (body: { account_id: string; niche: string; language: string }) =>
      post<{ job_id: string; status: string }>("/jobs/youtube/generate", body),
    createTwitter: (body: { account_id: string; topic: string }) =>
      post<{ job_id: string; status: string }>("/jobs/twitter/post", body),
  },
  accounts: {
    list: () => get<Account[]>("/accounts"),
    create: (body: Partial<Account>) => post<Account>("/accounts", body),
  },
  costs: {
    summary: () => get<CostSummary>("/costs"),
    budget: () => get<BudgetConfig>("/costs/budget"),
  },
}
