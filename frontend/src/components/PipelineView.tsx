import { cn } from "@/lib/utils"
import type { PipelineStep } from "@/lib/api"
import type { JobEvent } from "@/hooks/useJobStream"
import { CheckCircle2, Circle, Loader2, XCircle, SkipForward } from "lucide-react"

const STEP_LABELS: Record<string, string> = {
  generate_topic: "Generate topic",
  generate_script: "Write script",
  generate_metadata: "Title & description",
  generate_image_prompts: "Image prompts",
  generate_images: "Generate images",
  synthesize_audio: "Synthesize voice",
  generate_subtitles: "Transcribe audio",
  compose_video: "Compose video",
  generate_post: "Generate tweet",
}

interface Props {
  steps: PipelineStep[]
  liveEvents?: JobEvent[]
}

function StepIcon({ status }: { status: PipelineStep["status"] }) {
  if (status === "done") return <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
  if (status === "running") return <Loader2 className="w-5 h-5 text-blue-400 shrink-0 animate-spin" />
  if (status === "failed") return <XCircle className="w-5 h-5 text-red-400 shrink-0" />
  if (status === "skipped") return <SkipForward className="w-5 h-5 text-muted-foreground shrink-0" />
  return <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
}

function elapsed(start: string | null, end: string | null): string {
  if (!start) return ""
  const ms = new Date(end ?? new Date()).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function PipelineView({ steps, liveEvents = [] }: Props) {
  const liveByStep = liveEvents.reduce<Record<string, JobEvent>>((acc, e) => {
    if (e.step) acc[e.step] = e
    return acc
  }, {})

  const merged = steps.map((s) => {
    const live = liveByStep[s.step]
    if (!live) return s
    return {
      ...s,
      status: (live.status ?? s.status) as PipelineStep["status"],
      detail: live.detail ?? s.detail,
    }
  })

  if (merged.length === 0) {
    return <p className="text-sm text-muted-foreground">No steps yet.</p>
  }

  return (
    <ol className="space-y-2">
      {merged.map((step, i) => (
        <li
          key={`${step.step}-${i}`}
          className={cn(
            "flex items-start gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            step.status === "running" && "bg-blue-950/40",
            step.status === "done" && "bg-green-950/20",
            step.status === "failed" && "bg-red-950/30",
          )}
        >
          <StepIcon status={step.status} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "font-medium",
                  step.status === "pending" && "text-muted-foreground",
                )}
              >
                {STEP_LABELS[step.step] ?? step.step}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {elapsed(step.started_at, step.finished_at)}
              </span>
            </div>
            {step.detail && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{step.detail}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
