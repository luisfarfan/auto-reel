import { useEffect, useState, useCallback } from "react"
import { api, type Job, type CostSummary, type BudgetConfig, type PipelineStep } from "@/lib/api"
import { useJobStream } from "@/hooks/useJobStream"
import { PipelineView } from "@/components/PipelineView"
import { cn } from "@/lib/utils"
import { RefreshCw, Video, AtSign, DollarSign } from "lucide-react"

const STATUS_COLOR: Record<Job["status"], string> = {
  pending: "text-yellow-400",
  running: "text-blue-400",
  done: "text-green-400",
  failed: "text-red-400",
  cancelled: "text-muted-foreground",
}

const JOB_TYPE_ICON: Record<string, React.ReactNode> = {
  youtube_generate: <Video className="w-4 h-4" />,
  twitter_post: <AtSign className="w-4 h-4" />,
}

function JobCard({ job }: { job: Job }) {
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [expanded, setExpanded] = useState(job.status === "running")
  const { events } = useJobStream(job.status === "running" ? job.id : null)

  useEffect(() => {
    if (expanded) {
      api.jobs.steps(job.id).then(setSteps).catch(() => {})
    }
  }, [job.id, expanded])

  const liveProgress = events.find((e) => e.event === "step_update")?.progress

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{JOB_TYPE_ICON[job.type]}</span>
          <span className="font-medium text-sm">
            {job.type === "youtube_generate" ? "YouTube video" : "Twitter post"}
          </span>
        </div>
        <span className={cn("text-xs font-mono uppercase", STATUS_COLOR[job.status])}>
          {job.status}
        </span>
      </div>

      {job.status === "running" && liveProgress !== undefined && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${liveProgress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">{liveProgress}%</p>
        </div>
      )}

      {job.error && (
        <p className="text-xs text-red-400 font-mono bg-red-950/30 rounded px-2 py-1 truncate">
          {job.error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {new Date(job.created_at).toLocaleString()}
        </span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Hide steps" : "Show steps"}
        </button>
      </div>

      {expanded && (
        <div className="pt-1 border-t border-border">
          <PipelineView steps={steps} liveEvents={events} />
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

export function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [costs, setCosts] = useState<CostSummary | null>(null)
  const [budget, setBudget] = useState<BudgetConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [j, c, b] = await Promise.all([
        api.jobs.list({ }),
        api.costs.summary(),
        api.costs.budget(),
      ])
      setJobs(j)
      setCosts(c)
      setBudget(b)
    } catch {
      // silently fail on polling
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 10_000)
    return () => clearInterval(id)
  }, [load])

  const active = jobs.filter((j) => j.status === "running" || j.status === "pending")
  const recent = jobs.filter((j) => j.status !== "running" && j.status !== "pending").slice(0, 5)

  const dailyPct = costs && budget ? (costs.daily_usd / budget.daily_limit_usd) * 100 : 0

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard
          label="Jobs today"
          value={String(jobs.filter((j) => j.created_at > new Date(Date.now() - 86400000).toISOString()).length)}
          icon={<Video className="w-5 h-5" />}
        />
        <StatCard
          label="Daily spend"
          value={`$${costs?.daily_usd.toFixed(3) ?? "—"}`}
          sub={budget ? `/ $${budget.daily_limit_usd.toFixed(2)} limit` : undefined}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          label="Monthly spend"
          value={`$${costs?.monthly_usd.toFixed(3) ?? "—"}`}
          sub={budget ? `/ $${budget.monthly_limit_usd.toFixed(2)} limit` : undefined}
          icon={<DollarSign className="w-5 h-5" />}
        />
      </div>

      {/* Budget bar */}
      {costs && budget && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Daily budget</span>
            <span>{dailyPct.toFixed(1)}%</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                dailyPct >= 80 ? "bg-red-500" : dailyPct >= 50 ? "bg-yellow-500" : "bg-green-500",
              )}
              style={{ width: `${Math.min(dailyPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Active jobs */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Active ({active.length})
          </h2>
          {active.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </section>
      )}

      {/* Recent jobs */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Recent jobs
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet.</p>
        ) : (
          recent.map((j) => <JobCard key={j.id} job={j} />)
        )}
      </section>
    </div>
  )
}
