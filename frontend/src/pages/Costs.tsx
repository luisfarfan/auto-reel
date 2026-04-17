import { useEffect, useState } from "react"
import { api, type CostSummary, type BudgetConfig, type CostByService } from "@/lib/api"
import { cn } from "@/lib/utils"
import { DollarSign, Save, Loader2 } from "lucide-react"

function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-2 rounded-full bg-secondary overflow-hidden">
      <div
        className={cn("h-full transition-all", className ?? "bg-blue-500")}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function CostsPage() {
  const [summary, setSummary] = useState<CostSummary | null>(null)
  const [budget, setBudget] = useState<BudgetConfig | null>(null)
  const [byService, setByService] = useState<CostByService[]>([])
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // edit form state
  const [daily, setDaily] = useState("")
  const [monthly, setMonthly] = useState("")
  const [threshold, setThreshold] = useState("")

  const load = async () => {
    const [s, b, svc] = await Promise.all([
      api.costs.summary(),
      api.costs.budget(),
      api.costs.byService(),
    ])
    setSummary(s)
    setBudget(b)
    setByService(svc)
    setDaily(String(b.daily_limit_usd))
    setMonthly(String(b.monthly_limit_usd))
    setThreshold(String(b.alert_threshold))
  }

  useEffect(() => { load() }, [])

  const saveBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      await api.costs.updateBudget({
        daily_limit_usd: parseFloat(daily),
        monthly_limit_usd: parseFloat(monthly),
        alert_threshold: parseFloat(threshold),
      })
      setEditing(false)
      load()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const dailyPct = summary && budget ? (summary.daily_usd / budget.daily_limit_usd) * 100 : 0
  const monthlyPct = summary && budget ? (summary.monthly_usd / budget.monthly_limit_usd) * 100 : 0

  const barColor = (pct: number) =>
    pct >= 80 ? "bg-red-500" : pct >= 50 ? "bg-yellow-500" : "bg-green-500"

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <DollarSign className="w-6 h-6" /> Costs
      </h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Today", value: summary?.daily_usd ?? 0 },
          { label: "This month", value: summary?.monthly_usd ?? 0 },
          { label: "All time", value: summary?.total_usd ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold">${value.toFixed(4)}</p>
          </div>
        ))}
      </div>

      {/* Budget bars */}
      {budget && summary && (
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Budget</h2>
            <button
              onClick={() => setEditing((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {editing ? "Cancel" : "Edit limits"}
            </button>
          </div>

          {editing ? (
            <form onSubmit={saveBudget} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Daily limit ($)</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={daily}
                    onChange={(e) => setDaily(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Monthly limit ($)</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={monthly}
                    onChange={(e) => setMonthly(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Alert at (%)</label>
                  <input
                    type="number" step="0.05" min="0" max="1"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Daily</span>
                  <span className={dailyPct >= 80 ? "text-red-400" : "text-muted-foreground"}>
                    ${summary.daily_usd.toFixed(4)} / ${budget.daily_limit_usd.toFixed(2)} ({dailyPct.toFixed(1)}%)
                  </span>
                </div>
                <Bar value={summary.daily_usd} max={budget.daily_limit_usd} className={barColor(dailyPct)} />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Monthly</span>
                  <span className={monthlyPct >= 80 ? "text-red-400" : "text-muted-foreground"}>
                    ${summary.monthly_usd.toFixed(4)} / ${budget.monthly_limit_usd.toFixed(2)} ({monthlyPct.toFixed(1)}%)
                  </span>
                </div>
                <Bar value={summary.monthly_usd} max={budget.monthly_limit_usd} className={barColor(monthlyPct)} />
              </div>
            </div>
          )}
        </section>
      )}

      {/* By service */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          By service
        </h2>
        {byService.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cost records yet.</p>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Service</th>
                  <th className="text-right px-4 py-2 font-medium">Calls</th>
                  <th className="text-right px-4 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {byService.map((s) => (
                  <tr key={s.service} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-mono">{s.service}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{s.count}</td>
                    <td className="px-4 py-2 text-right">${s.total_usd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
