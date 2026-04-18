import { useEffect, useRef, useState } from "react"
import { api, type VideoRecord } from "@/lib/api"
import { Play, Pause, Volume2, VolumeX, Maximize2, Download } from "lucide-react"
import { cn } from "@/lib/utils"

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

function formatBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

interface Props {
  videoId: string
  jobId?: string
}

export function VideoPreview({ videoId, jobId }: Props) {
  const [video, setVideo] = useState<VideoRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        const record = jobId
          ? await api.videos.byJob(jobId)
          : await api.videos.getById(videoId)
        setVideo(record)
      } catch {
        setError("Video not found")
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [videoId, jobId])

  const streamUrl = `/api/videos/${video?.id}/stream`

  const togglePlay = () => {
    const el = videoRef.current
    if (!el) return
    if (el.paused) { el.play(); setPlaying(true) }
    else { el.pause(); setPlaying(false) }
  }

  const toggleMute = () => {
    const el = videoRef.current
    if (!el) return
    el.muted = !el.muted
    setMuted(el.muted)
  }

  const handleFullscreen = () => {
    videoRef.current?.requestFullscreen().catch(() => {})
  }

  const handleTimeUpdate = () => {
    const el = videoRef.current
    if (!el || !el.duration) return
    setProgress((el.currentTime / el.duration) * 100)
    setCurrentTime(el.currentTime)
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = videoRef.current
    if (!el) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    el.currentTime = pct * el.duration
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-card border border-border p-6 flex items-center justify-center h-32">
        <div className="w-5 h-5 border-2 border-border border-t-blue-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !video) {
    return (
      <div className="rounded-xl bg-card border border-border p-4 text-sm text-muted-foreground">
        {error ?? "No video available"}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Video */}
      <div className="relative bg-black group" style={{ aspectRatio: "9/16", maxHeight: 480, margin: "0 auto" }}>
        <video
          ref={videoRef}
          src={streamUrl}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setPlaying(false)}
          preload="metadata"
        />

        {/* Overlay controls */}
        <div className={cn(
          "absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
        )}>
          {/* Progress bar */}
          <div
            className="mx-3 mb-2 h-1 rounded-full bg-white/30 cursor-pointer"
            onClick={handleSeek}
          >
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2 px-3 pb-3">
            <button onClick={togglePlay} className="text-white hover:text-blue-300 transition-colors">
              {playing
                ? <Pause className="w-5 h-5" />
                : <Play className="w-5 h-5" />
              }
            </button>
            <button onClick={toggleMute} className="text-white hover:text-blue-300 transition-colors">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <span className="text-white/70 text-xs flex-1">
              {formatDuration(currentTime)}
              {video.duration_seconds ? ` / ${formatDuration(video.duration_seconds)}` : ""}
            </span>
            <button onClick={handleFullscreen} className="text-white hover:text-blue-300 transition-colors">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Play button centered when paused */}
        {!playing && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
              <Play className="w-6 h-6 text-white ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* Metadata */}
      <div className="p-3 space-y-1">
        {video.title && (
          <p className="text-sm font-medium line-clamp-1">{video.title}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {video.duration_seconds && (
            <span>{formatDuration(video.duration_seconds)}</span>
          )}
          {video.file_size_bytes && (
            <span>{formatBytes(video.file_size_bytes)}</span>
          )}
          {video.youtube_url && (
            <a
              href={video.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              YouTube ↗
            </a>
          )}
          <a
            href={streamUrl}
            download
            className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </a>
        </div>
      </div>
    </div>
  )
}
