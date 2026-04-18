import { useState } from "react"
import { cn } from "@/lib/utils"
import type { PipelineStep } from "@/lib/api"
import type { JobEvent } from "@/hooks/useJobStream"
import {
  CheckCircle2, Circle, Loader2, XCircle, SkipForward,
  ChevronDown, ChevronRight, DollarSign, Image,
} from "lucide-react"

const STEP_LABELS: Record<string, string> = {
  generate_topic:          "Generate topic",
  generate_script:         "Write script",
  generate_metadata:       "Title & description",
  generate_image_prompts:  "Image prompts",
  generate_images:         "Generate images",
  synthesize_audio:        "Synthesize voice",
  generate_subtitles:      "Transcribe audio",
  compose_video:           "Compose video",
  render_video:            "Render video",
  generate_post:           "Generate tweet",
  web_search:              "Web search",
  generate_code_snippets:  "Generate code examples",
  upload_youtube:          "Upload to YouTube",
}

interface MergedStep extends PipelineStep {
  live_cost_usd?: number
}

interface Props {
  steps: PipelineStep[]
  liveEvents?: JobEvent[]
}

function StepIcon({ status }: { status: PipelineStep["status"] }) {
  if (status === "done")    return <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
  if (status === "running") return <Loader2 className="w-4 h-4 text-blue-400 shrink-0 animate-spin" />
  if (status === "failed")  return <XCircle className="w-4 h-4 text-red-400 shrink-0" />
  if (status === "skipped") return <SkipForward className="w-4 h-4 text-muted-foreground shrink-0" />
  return <Circle className="w-4 h-4 text-muted-foreground/50 shrink-0" />
}

function elapsed(start: string | null, end: string | null): string {
  if (!start) return ""
  const ms = new Date(end ?? new Date()).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function StepMetaContent({ step, meta }: { step: string; meta: Record<string, unknown> }) {
  if (step === "generate_images" && Array.isArray(meta.images)) {
    return (
      <div className="flex flex-wrap gap-1.5 pt-1">
        {(meta.images as string[]).map((src, i) => (
          <img
            key={i}
            src={`/api/static?path=${encodeURIComponent(src)}`}
            className="w-16 h-16 object-cover rounded"
            onError={(e) => (e.currentTarget.style.display = "none")}
            alt=""
          />
        ))}
      </div>
    )
  }

  if (step === "generate_script" && typeof meta.script === "string") {
    return (
      <p className="text-xs text-muted-foreground bg-secondary/50 rounded p-2 mt-1 leading-relaxed whitespace-pre-wrap line-clamp-6">
        {meta.script}
      </p>
    )
  }

  if (step === "generate_image_prompts" && Array.isArray(meta.prompts)) {
    return (
      <ol className="mt-1 space-y-0.5">
        {(meta.prompts as string[]).map((p, i) => (
          <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
            <span className="text-muted-foreground/50 shrink-0">{i + 1}.</span>
            <span className="line-clamp-2">{p}</span>
          </li>
        ))}
      </ol>
    )
  }

  if (step === "generate_metadata") {
    return (
      <div className="mt-1 space-y-0.5">
        {typeof meta.title === "string" && (
          <p className="text-xs font-medium">{meta.title}</p>
        )}
        {typeof meta.description === "string" && (
          <p className="text-xs text-muted-foreground line-clamp-3">{meta.description}</p>
        )}
      </div>
    )
  }

  if (step === "generate_code_snippets" && Array.isArray(meta.snippets)) {
    return (
      <div className="mt-1 space-y-1">
        {(meta.snippets as Array<{ language: string; caption?: string }>).map((s, i) => (
          <div key={i} className="text-xs text-muted-foreground flex gap-1.5 items-center">
            <span className="font-mono bg-secondary rounded px-1">{s.language}</span>
            {s.caption && <span>{s.caption}</span>}
          </div>
        ))}
      </div>
    )
  }

  return null
}

function StepRow({ step }: { step: MergedStep }) {
  const [open, setOpen] = useState(step.status === "running")
  const hasMeta = step.meta && Object.keys(step.meta).length > 0
  const canExpand = hasMeta || !!step.detail

  return (
    <li className={cn(
      "rounded-lg px-3 py-2 text-sm transition-colors",
      step.status === "running" && "bg-blue-950/40",
      step.status === "done"    && "bg-green-950/20",
      step.status === "failed"  && "bg-red-950/30",
    )}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5"><StepIcon status={step.status} /></div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <button
              className={cn(
                "flex items-center gap-1 text-left",
                canExpand && "hover:text-foreground transition-colors",
                step.status === "pending" && "text-muted-foreground",
              )}
              onClick={() => canExpand && setOpen((v) => !v)}
              disabled={!canExpand}
            >
              {canExpand && (
                open
                  ? <ChevronDown className="w-3 h-3 shrink-0" />
                  : <ChevronRight className="w-3 h-3 shrink-0" />
              )}
              <span className="font-medium">{STEP_LABELS[step.step] ?? step.step}</span>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              {(step.live_cost_usd ?? 0) > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-yellow-500">
                  <DollarSign className="w-3 h-3" />
                  {step.live_cost_usd!.toFixed(4)}
                </span>
              )}
              {step.step === "generate_images" && step.status === "done" && step.meta?.images && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <Image className="w-3 h-3" />
                  {(step.meta.images as unknown[]).length}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {elapsed(step.started_at, step.finished_at)}
              </span>
            </div>
          </div>

          {step.detail && !open && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{step.detail}</p>
          )}

          {open && (
            <div>
              {step.detail && (
                <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
              )}
              {hasMeta && (
                <StepMetaContent step={step.step} meta={step.meta!} />
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

export function PipelineView({ steps, liveEvents = [] }: Props) {
  const liveCostByStep: Record<string, number> = {}
  const liveByStep: Record<string, JobEvent> = {}

  for (const e of liveEvents) {
    if (e.step) {
      liveByStep[e.step] = e
      if (e.cost_usd) liveCostByStep[e.step] = (liveCostByStep[e.step] ?? 0) + e.cost_usd
    }
  }

  const merged: MergedStep[] = steps.map((s) => {
    const live = liveByStep[s.step]
    return {
      ...s,
      status: (live?.status ?? s.status) as PipelineStep["status"],
      detail: live?.detail ?? s.detail,
      meta: (live?.meta ?? s.meta) as Record<string, unknown> | null,
      live_cost_usd: liveCostByStep[s.step] ?? 0,
    }
  })

  if (merged.length === 0) {
    return <p className="text-sm text-muted-foreground">No steps yet.</p>
  }

  return (
    <ol className="space-y-1">
      {merged.map((step, i) => (
        <StepRow key={`${step.step}-${i}`} step={step} />
      ))}
    </ol>
  )
}
