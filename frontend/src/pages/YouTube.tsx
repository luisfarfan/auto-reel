import { useEffect, useRef, useState } from "react"
import { api, type Account, type Job, type PipelineStep } from "@/lib/api"
import { useJobStream } from "@/hooks/useJobStream"
import { PipelineView } from "@/components/PipelineView"
import { cn } from "@/lib/utils"
import { Video, Plus, Loader2, ChevronDown, ChevronUp, Trash2, Cpu, Mic, Image, Captions, Search } from "lucide-react"

const DURATIONS = ["30s", "60s", "90s", "120s"]

const LANGUAGES = ["English", "Spanish", "Portuguese", "French", "German", "Italian", "Japanese"]

const VOICE_MAP: Record<string, string> = {
  English:    "en-US-JennyNeural",
  Spanish:    "es-MX-DaliaNeural",
  Portuguese: "pt-BR-FranciscaNeural",
  French:     "fr-FR-DeniseNeural",
  German:     "de-DE-KatjaNeural",
  Italian:    "it-IT-ElsaNeural",
  Japanese:   "ja-JP-NanamiNeural",
}

const DURATION_IMAGES: Record<string, number> = { "30s": 3, "60s": 4, "90s": 5, "120s": 6 }
const DURATION_WORDS: Record<string, number>  = { "30s": 75, "60s": 150, "90s": 225, "120s": 300 }

function ToolsPreview({ language, duration = "60s", webSearch = false }: { language: string; duration?: string; webSearch?: boolean }) {
  const voice = VOICE_MAP[language] ?? "en-US-JennyNeural"
  const nImages = DURATION_IMAGES[duration] ?? 4
  const imgCost = (nImages * 0.003).toFixed(3)

  const words = DURATION_WORDS[duration] ?? 150
  const tools = [
    { icon: <Cpu className="w-3.5 h-3.5" />,     label: "LLM",    value: "Ollama",              badge: "local · free" },
    { icon: <Search className="w-3.5 h-3.5" />,   label: "Search", value: webSearch ? "Tavily API" : "Disabled", badge: webSearch ? "web · free tier" : "—" },
    { icon: <Mic className="w-3.5 h-3.5" />,      label: "TTS",    value: `edge-tts · ${voice}`, badge: "Microsoft · free" },
    { icon: <Image className="w-3.5 h-3.5" />,    label: "Images", value: "FAL.AI FLUX schnell", badge: `${nImages} imgs · ~$${imgCost}` },
    { icon: <Captions className="w-3.5 h-3.5" />, label: "STT",    value: "Whisper base",        badge: "local · free" },
  ]

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/40 p-3 space-y-2">
      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
        Tools · ~{words} words · {nImages} images
      </p>
      <div className="grid grid-cols-1 gap-1.5">
        {tools.map((t) => (
          <div key={t.label} className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground shrink-0">{t.icon}</span>
            <span className="text-muted-foreground w-12 shrink-0">{t.label}</span>
            <span className="font-mono text-foreground">{t.value}</span>
            <span className="ml-auto text-muted-foreground/70 shrink-0">{t.badge}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VideoPlayer({ job }: { job: Job }) {
  const [videoId, setVideoId] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const rid = job.result?.video_id as string | undefined
    if (rid && rid !== "None") {
      setVideoId(rid)
      return
    }
    // fallback: look up video by job_id
    api.videos.byJob(job.id).then((v) => { if (v) setVideoId(v.id) }).catch(() => {})
  }, [job.id, job.result])

  if (!videoId) return null

  return (
    <div className="px-4 pb-4 flex flex-col items-center gap-2">
      <video
        ref={videoRef}
        src={`/api/videos/${videoId}/stream`}
        controls
        className="rounded-lg w-full"
        style={{ maxWidth: "220px", aspectRatio: "9/16" }}
      />
      <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">
        {job.result?.video_path as string}
      </p>
    </div>
  )
}

function JobRow({ job, onRefresh }: { job: Job; onRefresh: () => void }) {
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [expanded, setExpanded] = useState(false)
  const { events } = useJobStream(job.status === "running" ? job.id : null)

  useEffect(() => {
    if (expanded) api.jobs.steps(job.id).then(setSteps).catch(() => {})
  }, [job.id, expanded])

  useEffect(() => {
    const last = events[events.length - 1]
    if (last?.event === "job_done" || last?.event === "job_failed") onRefresh()
  }, [events, onRefresh])

  const progress = events.findLast((e) => e.progress != null)?.progress

  const statusColor: Record<Job["status"], string> = {
    pending: "text-yellow-400",
    running: "text-blue-400",
    done: "text-green-400",
    failed: "text-red-400",
    cancelled: "text-muted-foreground",
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/20 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Video className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {(job.input?.topic as string) || (job.input?.niche as string) || "YouTube video"}
          </p>
          <p className="text-xs text-muted-foreground">
            {[job.input?.duration_hint as string, job.input?.language as string].filter(Boolean).join(" · ")}
            {" · "}
            {new Date(job.created_at).toLocaleString()}
          </p>
        </div>
        {job.status === "running" && progress != null && (
          <span className="text-xs text-blue-400">{progress}%</span>
        )}
        <span className={cn("text-xs font-mono uppercase shrink-0", statusColor[job.status])}>
          {job.status}
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {job.status === "running" && progress != null && (
        <div className="h-0.5 bg-secondary">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {job.error && (
        <div className="px-4 pb-3">
          <p className="text-xs text-red-400 font-mono bg-red-950/30 rounded px-2 py-1 truncate">
            {job.error}
          </p>
        </div>
      )}

      {job.status === "done" && <VideoPlayer job={job} />}

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3">
          <PipelineView steps={steps} liveEvents={events} />
        </div>
      )}
    </div>
  )
}

export function YouTubePage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // job form
  const [accountId, setAccountId] = useState("")
  const [niche, setNiche] = useState("")
  const [topic, setTopic] = useState("")
  const [language, setLanguage] = useState("English")
  const [duration, setDuration] = useState("60s")
  const [webSearch, setWebSearch] = useState(false)

  // new account form
  const [accNickname, setAccNickname] = useState("")
  const [accNiche, setAccNiche] = useState("")
  const [accLanguage, setAccLanguage] = useState("English")
  const [accProfile, setAccProfile] = useState("")

  const load = async () => {
    const [accs, js] = await Promise.all([
      api.accounts.list("youtube"),
      api.jobs.list({ type: "youtube_generate" }),
    ])
    setAccounts(accs)
    setJobs(js)
    if (accs.length > 0 && !accountId) setAccountId(accs[0].id)
  }

  useEffect(() => { load() }, [])

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountId) { setError("Select an account"); return }
    if (!niche.trim()) { setError("Enter a niche"); return }
    setSubmitting(true)
    setError("")
    try {
      await api.jobs.createYoutube({
        account_id: accountId,
        niche: niche.trim(),
        topic: topic.trim() || undefined,
        language,
        web_search_enabled: webSearch,
        duration_hint: duration,
      })
      setNiche(""); setTopic("")
      setShowForm(false)
      load()
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accNickname.trim()) return
    setSubmitting(true)
    setError("")
    try {
      await api.accounts.create({
        platform: "youtube",
        nickname: accNickname.trim(),
        niche: accNiche.trim() || undefined,
        language: accLanguage,
        firefox_profile_path: accProfile.trim() || undefined,
      })
      setAccNickname(""); setAccNiche(""); setAccProfile("")
      setShowNewAccount(false)
      load()
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const deleteAccount = async (id: string) => {
    try {
      await api.accounts.delete(id)
      load()
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Video className="w-6 h-6" /> YouTube
        </h1>
        <button
          onClick={() => { setShowForm((v) => !v); setError("") }}
          className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> New job
        </button>
      </div>

      {/* Create job form */}
      {showForm && (
        <form onSubmit={createJob} className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h2 className="text-sm font-semibold">Generate video</h2>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Account</label>
            {accounts.length === 0 ? (
              <p className="text-xs text-yellow-400">No YouTube accounts. Create one below.</p>
            ) : (
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nickname} {a.niche ? `— ${a.niche}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Niche</label>
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. finance tips, cooking, fitness"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Specific topic <span className="text-muted-foreground/50">(optional — skips topic generation)</span>
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. 5 habits of millionaires"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
              >
                {DURATIONS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setWebSearch((v) => !v)}
              className={cn(
                "w-9 h-5 rounded-full transition-colors relative",
                webSearch ? "bg-blue-500" : "bg-secondary border border-border",
              )}
            >
              <div className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                webSearch ? "left-4" : "left-0.5",
              )} />
            </div>
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Web search <span className="text-muted-foreground/50">(Tavily — improves accuracy)</span>
            </span>
          </label>

          <ToolsPreview language={language} duration={duration} webSearch={webSearch} />

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

      {/* Accounts section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Accounts ({accounts.length})
          </h2>
          <button
            onClick={() => setShowNewAccount((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add account
          </button>
        </div>

        {showNewAccount && (
          <form onSubmit={createAccount} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">New YouTube account</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nickname *</label>
                <input
                  value={accNickname}
                  onChange={(e) => setAccNickname(e.target.value)}
                  placeholder="@mychannel"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Default niche</label>
                <input
                  value={accNiche}
                  onChange={(e) => setAccNiche(e.target.value)}
                  placeholder="funny cats"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Language</label>
                <select
                  value={accLanguage}
                  onChange={(e) => setAccLanguage(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                >
                  {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Firefox profile path</label>
                <input
                  value={accProfile}
                  onChange={(e) => setAccProfile(e.target.value)}
                  placeholder="/home/user/.mozilla/..."
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-3 h-3 animate-spin inline mr-1" />}
                Save
              </button>
              <button type="button" onClick={() => setShowNewAccount(false)} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2">Cancel</button>
            </div>
          </form>
        )}

        {accounts.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <Video className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{a.nickname}</p>
              <p className="text-xs text-muted-foreground">
                {[a.niche, a.language].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button
              onClick={() => deleteAccount(a.id)}
              className="text-muted-foreground hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {accounts.length === 0 && !showNewAccount && (
          <p className="text-sm text-muted-foreground">No accounts yet.</p>
        )}
      </section>

      {/* Jobs history */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Jobs ({jobs.length})
        </h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet.</p>
        ) : (
          jobs.map((j) => <JobRow key={j.id} job={j} onRefresh={load} />)
        )}
      </section>
    </div>
  )
}
