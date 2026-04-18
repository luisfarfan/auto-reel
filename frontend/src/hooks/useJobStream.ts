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
  video_id?: string
  total_cost_usd?: number
  timestamp: string
}

export interface JobStreamState {
  events: JobEvent[]
  lastEvent: JobEvent | null
  connected: boolean
  isDone: boolean
  isFailed: boolean
  totalCost: number | null
  videoId: string | null
  liveProgress: number
  reset: () => void
}

export function useJobStream(jobId: string | null): JobStreamState {
  const [events, setEvents] = useState<JobEvent[]>([])
  const [lastEvent, setLastEvent] = useState<JobEvent | null>(null)
  const [connected, setConnected] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [isFailed, setIsFailed] = useState(false)
  const [totalCost, setTotalCost] = useState<number | null>(null)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [liveProgress, setLiveProgress] = useState(0)
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

      if (data.event === "step_update" && data.progress !== undefined) {
        setLiveProgress(data.progress)
      }
      if (data.event === "job_done") {
        setIsDone(true)
        if (data.total_cost_usd !== undefined) setTotalCost(data.total_cost_usd)
        if (data.video_id) setVideoId(data.video_id)
      }
      if (data.event === "job_failed") {
        setIsFailed(true)
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [jobId])

  const reset = () => {
    setEvents([])
    setLastEvent(null)
    setIsDone(false)
    setIsFailed(false)
    setTotalCost(null)
    setVideoId(null)
    setLiveProgress(0)
  }

  return { events, lastEvent, connected, isDone, isFailed, totalCost, videoId, liveProgress, reset }
}
