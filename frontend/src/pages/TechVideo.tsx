import { useEffect, useState, useCallback } from "react"
import { api, type Account, type Job, type PipelineStep } from "@/lib/api"
import { useJobStream } from "@/hooks/useJobStream"
import { PipelineView } from "@/components/PipelineView"
import { VideoPreview } from "@/components/VideoPreview"
import { cn } from "@/lib/utils"
import {
  Film, Plus, Loader2, ChevronDown, ChevronUp,
  Search, Code2, Cpu, Mic, Image, Captions, Clapperboard,
  Globe, DollarSign,
} from "lucide-react"

const LANGUAGES = ["English", "Spanish", "Portuguese", "French", "German", "Italian", "Japanese"]
const TEMPLATES  = ["tech-dark", "minimal", "bold", "reel"] as const
const RESOLUTIONS = ["shorts", "landscape", "square"] as const
const DURATIONS  = ["30s", "60s", "90s", "120s"] as const
const MODELS = [
  "qwen2.5-coder:7b",
  "qwen2.5-coder:14b",
  "qwen2.5-coder:32b",
  "llama3.1:latest",
]

const MUSIC_TRACKS = [
  { value: "",                   label: "No music" },
  { value: "lofi-chill.mp3",     label: "Lo-Fi Chill" },
  { value: "upbeat-tech.mp3",    label: "Upbeat Tech" },
  { value: "cinematic-dark.mp3", label: "Cinematic Dark" },
  { value: "minimal-piano.mp3",  label: "Minimal Piano" },
  { value: "electronic-future.mp3", label: "Electronic Future" },
  { value: "hip-hop-beats.mp3",  label: "Hip Hop Beats" },
  { value: "ambient-space.mp3",  label: "Ambient Space" },
  { value: "corporate-bright.mp3", label: "Corporate Bright" },
]

const TEMPLATE_LABEL: Record<string, string> = {
  "tech-dark": "Tech Dark — code animations, dark bg",
  "minimal":   "Minimal — images + clean subtitles",
  "bold":      "Bold — high contrast, big text",
  "reel":      "Reel — vertical, fast cuts",
}

const RESOLUTION_LABEL: Record<string, string> = {
  shorts:    "Shorts 9:16 — YouTube / TikTok / Reels",
  landscape: "Landscape 16:9 — YouTube standard",
  square:    "Square 1:1 — Instagram feed",
}

function estCost(template: string, webSearch: boolean): string {
  const nImages = template === "tech-dark" ? 2 : 4
  const imgCost = nImages * 0.003
  return `~$${imgCost.toFixed(3)}`
}

function ToolsPreview({
  template, language, webSearch, model,
}: {
  template: string; language: string; webSearch: boolean; model: string
}) {
  const nImages = template === "tech-dark" ? 2 : 4

  const tools = [
    {
      icon: <Search className="w-3.5 h-3.5" />,
      label: "Search",
      value: webSearch ? "Tavily" : "Disabled",
      badge: webSearch ? "fresh docs · free tier" : "off",
      dim: !webSearch,
    },
    {
      icon: <Code2 className="w-3.5 h-3.5" />,
      label: "LLM",
      value: model,
      badge: "Ollama · local · free",
    },
    {
      icon: <Mic className="w-3.5 h-3.5" />,
      label: "TTS",
      value: `edge-tts`,
      badge: "Microsoft · free",
    },
    {
      icon: <Image className="w-3.5 h-3.5" />,
      label: "Images",
      value: "FAL.AI FLUX schnell",
      badge: `${nImages} imgs · ~$${(nImages * 0.003).toFixed(3)}`,
    },
    {
      icon: <Captions className="w-3.5 h-3.5" />,
      label: "STT",
      value: "Whisper base (word-level)",
      badge: "local · free",
    },
    {
      icon: <Clapperboard className="w-3.5 h-3.5" />,
      label: "Render",
      value: "Remotion",
      badge: "local · free",
    },
  ]

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Pipeline</p>
        <span className="text-xs text-yellow-500 flex items-center gap-0.5">
          <DollarSign className="w-3 h-3" />
          {estCost(template, webSearch)}
        </span>
      </div>
      <div className="space-y-1.5">
        {tools.map((t) => (
          <div key={t.label} className={cn("flex items-center gap-2 text-xs", t.dim && "opacity-40")}>
            <span className="text-muted-foreground shrink-0">{t.icon}</span>
            <span className="text-muted-foreground w-14 shrink-0">{t.label}</span>
            <span className="font-mono text-foreground truncate">{t.value}</span>
            <span className="ml-auto text-muted-foreground/70 shrink-0 text-right">{t.badge}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function JobRow({ job, onRefresh }: { job: Job; onRefresh: () => void }) {
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [stepsOpen, setStepsOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  const isActive = job.status === "running" || job.status === "pending"

  const { events, isDone, videoId, liveProgress } = useJobStream(isActive ? job.id : null)

  const resolvedVideoId =
    videoId ?? (job.result?.video_id as string | undefined) ?? null

  useEffect(() => {
    if (stepsOpen) api.jobs.steps(job.id).then(setSteps).catch(() => {})
  }, [job.id, stepsOpen])

  useEffect(() => {
    const last = events[events.length - 1]
    if (last?.event === "job_done" || last?.event === "job_failed") onRefresh()
  }, [events, onRefresh])

  useEffect(() => {
    if (isDone && resolvedVideoId) setVideoOpen(true)
  }, [isDone, resolvedVideoId])

  useEffect(() => {
    if (isActive) setStepsOpen(true)
  }, [isActive])

  const progress = isActive ? liveProgress : job.status === "done" ? 100 : 0
  const topic = (job.input?.topic as string) ?? "Tech video"
  const template = (job.input?.template as string) ?? "tech-dark"

  const statusColor: Record<Job["status"], string> = {
    pending:   "text-yellow-400",
    running:   "text-blue-400",
    done:      "text-green-400",
    failed:    "text-red-400",
    cancelled: "text-muted-foreground",
  }

  const statusDot: Record<Job["status"], string> = {
    pending:   "bg-yellow-400",
    running:   "bg-blue-400 animate-pulse",
    done:      "bg-green-400",
    failed:    "bg-red-400",
    cancelled: "bg-muted",
  }

  return (
    <div className={cn(
      "rounded-lg border bg-card overflow-hidden transition-all",
      job.status === "running" ? "border-blue-500/40" : "border-border",
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={cn("w-2 h-2 rounded-full shrink-0", statusDot[job.status])} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{topic}</p>
          <p className="text-xs text-muted-foreground">
            {template}
            {job.input?.duration_hint ? ` · ${job.input.duration_hint as string}` : ""}
            {" · "}
            {new Date(job.created_at).toLocaleString()}
          </p>
        </div>
        {isActive && progress > 0 && (
          <span className="text-xs text-blue-400 font-mono shrink-0">{progress}%</span>
        )}
        <span className={cn("text-xs font-mono uppercase shrink-0", statusColor[job.status])}>
          {job.status}
        </span>
      </div>

      {/* Progress bar */}
      {isActive && (
        <div className="h-0.5 bg-secondary">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Error */}
      {job.error && (
        <div className="px-4 py-2">
          <p className="text-xs text-red-400 font-mono bg-red-950/30 rounded px-2 py-1 truncate">
            {job.error}
          </p>
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
              Video ready
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
    </div>
  )
}

export function TechVideoPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // form state
  const [accountId, setAccountId] = useState("")
  const [topic, setTopic] = useState("")
  const [language, setLanguage] = useState("English")
  const [template, setTemplate] = useState<typeof TEMPLATES[number]>("tech-dark")
  const [resolution, setResolution] = useState<typeof RESOLUTIONS[number]>("shorts")
  const [duration, setDuration] = useState<typeof DURATIONS[number]>("60s")
  const [webSearch, setWebSearch] = useState(true)
  const [model, setModel] = useState(MODELS[0])
  const [musicTrack, setMusicTrack] = useState("")

  const load = useCallback(async () => {
    const [accs, js] = await Promise.all([
      api.accounts.list("youtube"),
      api.jobs.list({ type: "remotion_generate" }),
    ])
    setAccounts(accs)
    setJobs(js)
    if (accs.length > 0 && !accountId) setAccountId(accs[0].id)
  }, [accountId])

  useEffect(() => { load() }, [])

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountId) { setError("Select an account"); return }
    if (!topic.trim()) { setError("Enter a topic"); return }
    setSubmitting(true)
    setError("")
    try {
      await api.jobs.createRemotion({
        account_id: accountId,
        topic: topic.trim(),
        language,
        template,
        resolution,
        web_search_enabled: webSearch,
        model,
        duration_hint: duration,
        music_track: musicTrack || null,
      })
      setTopic("")
      setShowForm(false)
      load()
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Film className="w-6 h-6" /> Tech Videos
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Remotion renderer · web search · code animations
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setError("") }}
          className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> New video
        </button>
      </div>

      {/* Create job form */}
      {showForm && (
        <form onSubmit={createJob} className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h2 className="text-sm font-semibold">Generate tech video</h2>

          {/* Account */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Account</label>
            {accounts.length === 0 ? (
              <p className="text-xs text-yellow-400">No YouTube accounts. Add one in the YouTube page.</p>
            ) : (
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nickname}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Topic */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Topic</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Angular 19 new features, React Server Components"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground"
            />
          </div>

          {/* Template + Resolution */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Template</label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as typeof TEMPLATES[number])}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
              >
                {TEMPLATES.map((t) => (
                  <option key={t} value={t}>{TEMPLATE_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as typeof RESOLUTIONS[number])}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
              >
                {RESOLUTIONS.map((r) => (
                  <option key={r} value={r}>{RESOLUTION_LABEL[r]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Duration + Language */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value as typeof DURATIONS[number])}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
              >
                {DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
              >
                {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Model */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">LLM model (Ollama)</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
            >
              {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Music */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Background music</label>
            <select
              value={musicTrack}
              onChange={(e) => setMusicTrack(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
            >
              {MUSIC_TRACKS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground/60">
              Download CC0 tracks — see remotion-service/public/music/CREDITS.md
            </p>
          </div>

          {/* Web search toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setWebSearch((v) => !v)}
              className={cn(
                "w-9 h-5 rounded-full transition-colors relative",
                webSearch ? "bg-blue-500" : "bg-secondary border border-border",
              )}
            >
              <div className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                webSearch ? "translate-x-4" : "translate-x-0.5",
              )} />
            </div>
            <div>
              <span className="text-sm flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                Web search (Tavily)
              </span>
              <p className="text-xs text-muted-foreground">
                Fetches real docs for accuracy. Needs TAVILY_API_KEY.
              </p>
            </div>
          </label>

          {/* Tools preview */}
          <ToolsPreview
            template={template}
            language={language}
            webSearch={webSearch}
            model={model}
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || accounts.length === 0}
              className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              Generate
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-muted-foreground hover:text-foreground px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Jobs history */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Jobs ({jobs.length})
          </h2>
          <button
            onClick={load}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Refresh
          </button>
        </div>
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Film className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No tech videos yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Create your first video above.
            </p>
          </div>
        ) : (
          jobs.map((j) => <JobRow key={j.id} job={j} onRefresh={load} />)
        )}
      </section>
    </div>
  )
}
