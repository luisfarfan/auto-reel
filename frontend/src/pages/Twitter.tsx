import { useEffect, useState } from "react"
import { api, type Account, type Job } from "@/lib/api"
import { AccountRow } from "@/components/AccountRow"
import { cn } from "@/lib/utils"
import { AtSign, Plus, Loader2 } from "lucide-react"

function JobRow({ job }: { job: Job }) {
  const statusColor: Record<Job["status"], string> = {
    pending: "text-yellow-400",
    running: "text-blue-400",
    done: "text-green-400",
    failed: "text-red-400",
    cancelled: "text-muted-foreground",
  }

  const content = job.result?.content as string | undefined

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium truncate">
          {(job.input?.topic as string) ?? "Tweet"}
        </p>
        <span className={cn("text-xs font-mono uppercase shrink-0", statusColor[job.status])}>
          {job.status}
        </span>
      </div>
      {content && (
        <p className="text-xs text-muted-foreground bg-secondary rounded px-2 py-1.5 leading-relaxed">
          {content}
        </p>
      )}
      {job.error && (
        <p className="text-xs text-red-400 font-mono bg-red-950/30 rounded px-2 py-1 truncate">
          {job.error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{new Date(job.created_at).toLocaleString()}</p>
    </div>
  )
}

export function TwitterPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // job form
  const [accountId, setAccountId] = useState("")
  const [topic, setTopic] = useState("")

  // account form
  const [accNickname, setAccNickname] = useState("")
  const [accTopic, setAccTopic] = useState("")
  const [accProfile, setAccProfile] = useState("")

  const load = async () => {
    const [accs, js] = await Promise.all([
      api.accounts.list("twitter"),
      api.jobs.list({ type: "twitter_post" }),
    ])
    setAccounts(accs)
    setJobs(js)
    if (accs.length > 0 && !accountId) setAccountId(accs[0].id)
  }

  useEffect(() => { load() }, [])

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountId) { setError("Select an account"); return }
    if (!topic.trim()) { setError("Enter a topic"); return }
    setSubmitting(true)
    setError("")
    try {
      await api.jobs.createTwitter({ account_id: accountId, topic: topic.trim() })
      setTopic("")
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
        platform: "twitter",
        nickname: accNickname.trim(),
        topic: accTopic.trim() || undefined,
        firefox_profile_path: accProfile.trim() || undefined,
      })
      setAccNickname(""); setAccTopic(""); setAccProfile("")
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
          <AtSign className="w-6 h-6" /> Twitter
        </h1>
        <button
          onClick={() => { setShowForm((v) => !v); setError("") }}
          className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> New tweet
        </button>
      </div>

      {showForm && (
        <form onSubmit={createJob} className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h2 className="text-sm font-semibold">Generate & post tweet</h2>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Account</label>
            {accounts.length === 0 ? (
              <p className="text-xs text-yellow-400">No Twitter accounts. Create one below.</p>
            ) : (
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.nickname}</option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Topic</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. AI news, crypto, motivational"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || accounts.length === 0}
              className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              Post tweet
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2">Cancel</button>
          </div>
        </form>
      )}

      {/* Accounts */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Accounts ({accounts.length})
          </h2>
          <button
            onClick={() => setShowNewAccount((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add account
          </button>
        </div>

        {showNewAccount && (
          <form onSubmit={createAccount} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">New Twitter account</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nickname *</label>
                <input
                  value={accNickname}
                  onChange={(e) => setAccNickname(e.target.value)}
                  placeholder="@handle"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Default topic</label>
                <input
                  value={accTopic}
                  onChange={(e) => setAccTopic(e.target.value)}
                  placeholder="AI news"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground"
                />
              </div>
              <div className="col-span-2 space-y-1">
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
              <button type="submit" disabled={submitting} className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50">
                {submitting && <Loader2 className="w-3 h-3 animate-spin inline mr-1" />}Save
              </button>
              <button type="button" onClick={() => setShowNewAccount(false)} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2">Cancel</button>
            </div>
          </form>
        )}

        {accounts.map((a) => (
          <AccountRow
            key={a.id}
            account={a}
            icon={<AtSign className="w-4 h-4" />}
            subtitle={a.topic ?? undefined}
            onDelete={deleteAccount}
            onRefresh={load}
          />
        ))}

        {accounts.length === 0 && !showNewAccount && (
          <p className="text-sm text-muted-foreground">No accounts yet.</p>
        )}
      </section>

      {/* Jobs */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Jobs ({jobs.length})
        </h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet.</p>
        ) : (
          jobs.map((j) => <JobRow key={j.id} job={j} />)
        )}
      </section>
    </div>
  )
}
