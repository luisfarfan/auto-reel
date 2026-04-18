import { useEffect, useState, useCallback } from "react"
import { api, type Job, type CostSummary, type BudgetConfig, type PipelineStep } from "@/lib/api"
import { useJobStream } from "@/hooks/useJobStream"
import { PipelineView } from "@/components/PipelineView"
import { VideoPreview } from "@/components/VideoPreview"
import { cn } from "@/lib/utils"
import {
  RefreshCw, Video, AtSign, DollarSign,
  ChevronDown, ChevronUp, Film, Cpu,
} from "lucide-react"

const STATUS_COLOR: Record<Job["status"], string> = {
  pending:   "text-yellow-400",
  running:   "text-blue-400",
  done:      "text-green-400",
  failed:    "text-red-400",
  cancelled: "text-muted-foreground",
}

const STATUS_DOT: Record<Job["status"], string> = {
  pending:   "bg-yellow-400",
  running:   "bg-blue-400 animate-pulse",
  done:      "bg-green-400",
  failed:    "bg-red-400",
  cancelled: "bg-muted-foreground",
}

const JOB_TYPE_LABEL: Record<string, string> = {
  youtube_generate:  "YouTube video",
  twitter_post:      "Twitter post",
  remotion_generate: "Tech video",
}

const JOB_TYPE_ICON: Record<string, React.ReactNode> = {
  youtube_generate:  <Video className="w-4 h-4" />,
  twitter_post:      <AtSign className="w-4 h-4" />,
  remotion_generate: <Film className="w-4 h-4" />,
}

function CostBadge({ usd }: { usd: number }) {
  if (usd === 0) return null
  return (
    <span className="flex items-center gap-0.5 text-xs text-yellow-500 font-mono">
      <DollarSign className="w-3 h-3" />
      {usd.toFixed(4)}
    </span>
  )
}

function JobCard({ job }: { job: Job }) {
  const isActive = job.status === "running" || job.status === "pending"
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [stepsOpen, setStepsOpen] = useState(isActive)
  const [videoOpen, setVideoOpen] = useState(false)

  const { events, isDone, isFailed, totalCost, videoId, liveProgress } = useJobStream(
    isActive ? job.id : null,
  )

  // Resolve videoId: from WS event (live) or from job.result (already done)
  const resolvedVideoId =
    videoId ??
    (job.result?.video_id as string | undefined) ??
    null

  const resolvedCost =
    totalCost ??
    (job.result?.total_cost_usd as number | undefined) ??
    null

  // Load steps when expanded
  useEffect(() => {
    if (stepsOpen) {
      api.jobs.steps(job.id).then(setSteps).catch(() => {})
    }
  }, [job.id, stepsOpen])

  // Auto-expand video section when job completes via WS
  useEffect(() => {
    if (isDone && resolvedVideoId) setVideoOpen(true)
  }, [isDone, resolvedVideoId])

  // Auto-open steps when running
  useEffect(() => {
    if (job.status === "running") setStepsOpen(true)
  }, [job.status])

  const progress = isActive ? liveProgress : job.status === "done" ? 100 : 0

  return (
    <div className={cn(
      "rounded-xl border bg-card transition-all duration-200",
      job.status === "running" ? "border-blue-500/40" : "border-border",
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[job.status])} />
        <span className="text-muted-foreground shrink-0">
          {JOB_TYPE_ICON[job.type] ?? <Cpu className="w-4 h-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{JOB_TYPE_LABEL[job.type] ?? job.type}</p>
          {job.input && (
            <p className="text-xs text-muted-foreground truncate">
              {(job.input.niche as string) ?? (job.input.topic as string) ?? ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {resolvedCost !== null && <CostBadge usd={resolvedCost} />}
          <span className={cn("text-xs font-mono uppercase", STATUS_COLOR[job.status])}>
            {job.status}
          </span>
        </div>
      </div>

      {/* Progress bar (running only) */}
      {isActive && (
        <div className="px-4 pb-1">
          <div className="h-1 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-right text-xs text-muted-foreground mt-0.5">{progress}%</p>
        </div>
      )}

      {/* Error */}
      {(job.error || isFailed) && (
        <div className="mx-4 mb-2 text-xs text-red-400 font-mono bg-red-950/30 rounded px-2 py-1">
          {job.error ?? "Job failed"}
        </div>
      )}

      {/* Video section */}
      {resolvedVideoId && (
        <div className="border-t border-border">
          <button
            onClick={() => setVideoOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5" />
              Video generated
            </span>
            {videoOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {videoOpen && (
            <div className="px-4 pb-4">
              <VideoPreview videoId={resolvedVideoId} />
            </div>
          )}
        </div>
      )}

      {/* Pipeline steps */}
      <div className="border-t border-border">
        <button
          onClick={() => setStepsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>
            {isActive ? "Live pipeline" : "Pipeline steps"}
            {steps.length > 0 && (
              <span className="ml-1.5 opacity-60">
                ({steps.filter((s) => s.status === "done").length}/{steps.length})
              </span>
            )}
          </span>
          {stepsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {stepsOpen && (
          <div className="px-4 pb-4">
            <PipelineView steps={steps} liveEvents={events} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
        {new Date(job.created_at).toLocaleString()}
      </div>
    </div>
  )
}

function StatCard({
  label, value, sub, icon,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode
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
        api.jobs.list({}),
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
  const recent = jobs.filter((j) => j.status !== "running" && j.status !== "pending").slice(0, 10)

  const dailyPct = costs && budget ? (costs.daily_usd / budget.daily_limit_usd) * 100 : 0

  return (
    <div className="p-6 space-y-8 max-w-2xl mx-auto">
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
          value={String(
            jobs.filter((j) => j.created_at > new Date(Date.now() - 86400000).toISOString()).length,
          )}
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
          {active.map((j) => <JobCard key={j.id} job={j} />)}
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
