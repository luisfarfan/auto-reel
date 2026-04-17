import { useEffect, useRef, useState } from "react"

export interface JobEvent {
  event: string
  job_id: string
  step?: string
  status?: string
  detail?: string
  progress?: number
  cost_usd?: number
  meta?: Record<string, unknown>
  error?: string
  video_path?: string
  total_cost_usd?: number
  timestamp: string
}

export function useJobStream(jobId: string | null) {
  const [events, setEvents] = useState<JobEvent[]>([])
  const [lastEvent, setLastEvent] = useState<JobEvent | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!jobId) return

    const proto = window.location.protocol === "https:" ? "wss" : "ws"
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/jobs/${jobId}`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    ws.onmessage = (e: MessageEvent) => {
      const data = JSON.parse(e.data as string) as JobEvent
      setLastEvent(data)
      setEvents((prev) => [...prev, data])
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [jobId])

  const reset = () => {
    setEvents([])
    setLastEvent(null)
  }

  return { events, lastEvent, connected, reset }
}
