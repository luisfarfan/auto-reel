import { useCallback, useEffect, useRef, useState } from "react"
import { api, type Account } from "@/lib/api"
import { cn } from "@/lib/utils"
import { CheckCircle, Loader2, Trash2, Wifi, WifiOff } from "lucide-react"

const CONNECT_TERMINAL = ["connected", "timeout", "failed"]

export function AccountRow({
  account,
  icon,
  subtitle,
  onDelete,
  onRefresh,
}: {
  account: Account
  icon: React.ReactNode
  subtitle?: string
  onDelete: (id: string) => void
  onRefresh: () => void
}) {
  const [connectMsg, setConnectMsg] = useState("")
  const [connecting, setConnecting] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const startConnect = useCallback(async () => {
    if (connecting) return
    setConnecting(true)
    setConnectMsg("Requesting Firefox...")
    try {
      await api.accounts.connect(account.id)
    } catch (err) {
      setConnectMsg(`Error: ${err}`)
      setConnecting(false)
      return
    }

    const proto = window.location.protocol === "https:" ? "wss" : "ws"
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/accounts/${account.id}`)
    wsRef.current = ws
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      setConnectMsg(data.message ?? data.status)
      if (CONNECT_TERMINAL.includes(data.status)) {
        setConnecting(false)
        ws.close()
        onRefresh()
      }
    }
    ws.onerror = () => {
      setConnectMsg("WebSocket error")
      setConnecting(false)
    }
  }, [account.id, connecting, onRefresh])

  useEffect(() => () => { wsRef.current?.close() }, [])

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{account.nickname}</p>
            {account.connected ? (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <CheckCircle className="w-3 h-3" /> connected
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/50">not connected</span>
            )}
          </div>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <button
          onClick={startConnect}
          disabled={connecting}
          title={account.connected ? "Re-connect session" : "Connect account"}
          className={cn(
            "flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md transition-colors shrink-0",
            account.connected
              ? "text-green-400 hover:bg-green-400/10 border border-green-400/30"
              : "text-blue-400 hover:bg-blue-400/10 border border-blue-400/30",
            connecting && "opacity-60 cursor-not-allowed",
          )}
        >
          {connecting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : account.connected ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          {account.connected ? "Re-connect" : "Connect"}
        </button>
        <button
          onClick={() => onDelete(account.id)}
          className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {connecting && connectMsg && (
        <div className="px-4 pb-3">
          <p className="text-xs text-blue-400 font-mono bg-blue-950/30 rounded px-2 py-1 flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            {connectMsg}
          </p>
        </div>
      )}
      {!connecting && connectMsg && (
        <div className="px-4 pb-3">
          <p className={cn(
            "text-xs font-mono rounded px-2 py-1",
            connectMsg.toLowerCase().includes("error") || connectMsg.toLowerCase().includes("timed")
              ? "text-red-400 bg-red-950/30"
              : "text-green-400 bg-green-950/30",
          )}>
            {connectMsg}
          </p>
        </div>
      )}
    </div>
  )
}
