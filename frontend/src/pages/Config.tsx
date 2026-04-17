import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Settings, Save, Loader2, RefreshCw } from "lucide-react"

type ConfigValue = string | number | boolean | null | Record<string, unknown>

const EDITABLE_KEYS: { key: string; label: string; type: "text" | "number" | "boolean" }[] = [
  { key: "ollama_model", label: "Ollama model", type: "text" },
  { key: "ollama_base_url", label: "Ollama base URL", type: "text" },
  { key: "fal_api_key", label: "FAL.AI key", type: "text" },
  { key: "fal_model", label: "FAL.AI model", type: "text" },
  { key: "threads", label: "Video render threads", type: "number" },
  { key: "headless", label: "Headless browser", type: "boolean" },
  { key: "firefox_profile", label: "Firefox profile path", type: "text" },
  { key: "whisper_model", label: "Whisper model", type: "text" },
  { key: "twitter_language", label: "Twitter language", type: "text" },
]

export function ConfigPage() {
  const [config, setConfig] = useState<Record<string, ConfigValue>>({})
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const c = await api.config.get()
      setConfig(c as Record<string, ConfigValue>)
      const init: Record<string, string> = {}
      for (const { key } of EDITABLE_KEYS) {
        const v = c[key]
        init[key] = v != null ? String(v) : ""
      }
      setValues(init)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      const patch: Record<string, ConfigValue> = {}
      for (const { key, type } of EDITABLE_KEYS) {
        const v = values[key]
        if (type === "number") patch[key] = Number(v)
        else if (type === "boolean") patch[key] = v === "true"
        else patch[key] = v
      }
      await api.config.patch(patch)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const set = (key: string, val: string) => setValues((v) => ({ ...v, [key]: val }))

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6" /> Config
        </h1>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Reload
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading config…
        </div>
      ) : (
        <form onSubmit={save} className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            {EDITABLE_KEYS.map(({ key, label, type }) => (
              <div key={key} className="flex items-center gap-4">
                <label className="text-sm text-muted-foreground w-48 shrink-0">{label}</label>
                {type === "boolean" ? (
                  <select
                    value={values[key]}
                    onChange={(e) => set(key, e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    type={type === "number" ? "number" : "text"}
                    value={values[key]}
                    onChange={(e) => set(key, e.target.value)}
                    className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm font-mono placeholder:text-muted-foreground"
                  />
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? "Saved!" : "Save"}
          </button>
        </form>
      )}

      {/* Raw JSON viewer */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Raw config.json
        </h2>
        <pre className="rounded-xl border border-border bg-card p-4 text-xs font-mono overflow-auto max-h-96 text-muted-foreground">
          {JSON.stringify(config, null, 2)}
        </pre>
      </section>
    </div>
  )
}
