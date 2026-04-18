"""
Celery task: generate a tech video rendered by the Remotion microservice.

Pipeline:
  web_search (optional) → generate_script → generate_metadata →
  generate_code_snippets → generate_image_prompts → generate_images →
  synthesize_audio → generate_subtitles → render_video
"""
import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from celery import Task

from backend.workers.celery_app import celery_app
from backend.settings import settings

VOICE_MAP = {
    "English":    "en-US-JennyNeural",
    "Spanish":    "es-MX-DaliaNeural",
    "Portuguese": "pt-BR-FranciscaNeural",
    "French":     "fr-FR-DeniseNeural",
    "German":     "de-DE-KatjaNeural",
    "Italian":    "it-IT-ElsaNeural",
    "Japanese":   "ja-JP-NanamiNeural",
}

WHISPER_LANG_MAP = {
    "English": "en", "Spanish": "es", "Portuguese": "pt",
    "French": "fr", "German": "de", "Italian": "it", "Japanese": "ja",
}

DURATION_WORDS = {"30s": 75, "60s": 150, "90s": 225, "120s": 300}

STEPS = [
    "web_search",
    "generate_script",
    "generate_metadata",
    "generate_code_snippets",
    "generate_image_prompts",
    "generate_images",
    "synthesize_audio",
    "generate_subtitles",
    "render_video",
]

STEP_PROGRESS = {
    "web_search":              10,
    "generate_script":         20,
    "generate_metadata":       28,
    "generate_code_snippets":  36,
    "generate_image_prompts":  42,
    "generate_images":         55,
    "synthesize_audio":        65,
    "generate_subtitles":      75,
    "render_video":            95,
}


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30, name="remotion.generate_video")
def generate_tech_video(
    self: Task,
    job_id: str,
    account_id: str,
    topic: str,
    language: str,
    template: str,
    resolution: str,
    web_search_enabled: bool,
    model: str,
    music_track: str | None,
    duration_hint: str,
) -> dict:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker, Session
    from backend.models.job import Job, PipelineStep
    from backend.models.video import Video
    from backend.models.cost import CostRecord

    sync_url = settings.database_url.replace("+asyncpg", "+psycopg2")
    try:
        engine = create_engine(sync_url)
        SessionLocal = sessionmaker(engine)
    except Exception:
        sync_url = settings.database_url.replace("+asyncpg", "")
        engine = create_engine(sync_url)
        SessionLocal = sessionmaker(engine)

    import redis as _redis
    r = _redis.from_url(settings.redis_url, decode_responses=True)

    def publish(step: str, status: str, detail: str = "", meta: dict = {}):
        payload = json.dumps({
            "event": "step_update",
            "job_id": job_id,
            "step": step,
            "status": status,
            "detail": detail,
            "progress": STEP_PROGRESS.get(step, 0) if status == "running" else
                        STEP_PROGRESS.get(step, 0) + 3,
            "cost_usd": 0.0,
            "meta": meta,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        r.publish(f"job:{job_id}", payload)

    def update_step(db: Session, step: str, status: str, detail: str = "", meta: dict = {}):
        row = db.query(PipelineStep).filter_by(job_id=job_id, step=step).first()
        if row:
            row.status = status
            row.detail = detail
            row.meta = meta
            if status == "running":
                row.started_at = datetime.now(timezone.utc)
            elif status in ("done", "failed", "skipped"):
                row.finished_at = datetime.now(timezone.utc)
        db.commit()

    def record_cost(db: Session, service: str, operation: str, cost_usd: float,
                    model_name: str = "", meta: dict = {}) -> float:
        db.add(CostRecord(
            job_id=job_id, service=service, operation=operation,
            cost_usd=Decimal(str(cost_usd)), model=model_name, meta=meta,
        ))
        db.commit()
        return cost_usd

    with SessionLocal() as db:
        job = db.get(Job, job_id)
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.error = None
        job.started_at = datetime.now(timezone.utc)
        job.celery_task_id = self.request.id
        db.commit()

        if db.query(PipelineStep).filter_by(job_id=job_id).count() == 0:
            for step in STEPS:
                db.add(PipelineStep(job_id=job_id, step=step, status="pending"))
            db.commit()

        r.publish(f"job:{job_id}", json.dumps({
            "event": "job_started", "job_id": job_id,
            "total_steps": len(STEPS),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }))

        try:
            import sys
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../src"))
            from llm_provider import select_model, generate_text
            from config import get_fal_api_key, get_fal_model, ROOT_DIR

            select_model(model)
            total_cost = 0.0
            os.makedirs(os.path.join(ROOT_DIR, ".mp"), exist_ok=True)

            target_words = DURATION_WORDS.get(duration_hint, 150)

            # ── STEP 1: web_search ──────────────────────────────────────
            search_context = ""
            if web_search_enabled and settings.tavily_api_key:
                publish("web_search", "running", f"Searching: {topic}...")
                update_step(db, "web_search", "running")
                try:
                    import requests as req
                    resp = req.post(
                        "https://api.tavily.com/search",
                        json={
                            "api_key": settings.tavily_api_key,
                            "query": topic,
                            "max_results": 6,
                            "search_depth": "basic",
                            "include_answer": True,
                        },
                        timeout=15,
                    )
                    data = resp.json()
                    results = data.get("results", [])
                    search_context = "\n\n".join(
                        f"Source: {r['title']}\n{r['content'][:600]}"
                        for r in results[:5]
                    )
                    detail = f"{len(results)} sources found"
                    update_step(db, "web_search", "done", detail, {"sources": len(results)})
                    publish("web_search", "done", detail, {"sources": len(results)})
                except Exception as e:
                    update_step(db, "web_search", "skipped", f"Search failed: {e}")
                    publish("web_search", "skipped", "Skipped (search unavailable)")
            else:
                update_step(db, "web_search", "skipped", "Web search disabled")
                publish("web_search", "skipped", "Web search disabled")

            # ── STEP 2: generate_script ─────────────────────────────────
            publish("generate_script", "running", "Writing script...")
            update_step(db, "generate_script", "running")

            context_block = (
                f"\n\nResearch context (use this for accuracy):\n{search_context}"
                if search_context else ""
            )
            script = generate_text(
                f"Write a {target_words}-word script for a {duration_hint} video about: {topic}.\n"
                f"Language: {language}.\n"
                f"Style: educational, engaging, conversational. No filler words.\n"
                f"Return ONLY the script text, no labels, no markdown.{context_block}",
                max_tokens=target_words * 2,
            ).strip()

            record_cost(db, "ollama", "generate_text", 0.0, model)
            update_step(db, "generate_script", "done", script[:100] + "...", {"script": script})
            publish("generate_script", "done", script[:80] + "...", {"script": script})

            # ── STEP 3: generate_metadata ───────────────────────────────
            publish("generate_metadata", "running", "Generating title & description...")
            update_step(db, "generate_metadata", "running")

            title = generate_text(
                f"Write a YouTube title with hashtags for a video about: {topic}. "
                "Max 90 chars. Return ONLY the title.",
                max_tokens=60,
            ).strip()[:90]

            description = generate_text(
                f"Write a YouTube description for: {topic}. "
                "Max 3 sentences. Return ONLY the description.",
                max_tokens=120,
            ).strip()

            record_cost(db, "ollama", "generate_text", 0.0, model)
            metadata = {"title": title, "description": description}
            update_step(db, "generate_metadata", "done", title, metadata)
            publish("generate_metadata", "done", title, metadata)

            # ── STEP 4: generate_code_snippets ──────────────────────────
            code_snippets = []
            if template == "tech-dark":
                publish("generate_code_snippets", "running", "Generating code examples...")
                update_step(db, "generate_code_snippets", "running")

                raw = generate_text(
                    f"Generate 2 practical code examples for: {topic}.\n"
                    f"Use the most relevant programming language.\n"
                    f"{context_block}\n"
                    "Return ONLY a JSON array:\n"
                    '[{"language":"typescript","code":"...","caption":"short description"},...]',
                    max_tokens=800,
                ).replace("```json", "").replace("```", "").strip()

                try:
                    code_snippets = json.loads(raw)[:3]
                except Exception:
                    code_snippets = []

                record_cost(db, "ollama", "generate_text", 0.0, model)
                meta = {"snippets": code_snippets}
                update_step(db, "generate_code_snippets", "done",
                            f"{len(code_snippets)} snippets", meta)
                publish("generate_code_snippets", "done",
                        f"{len(code_snippets)} code examples", meta)
            else:
                update_step(db, "generate_code_snippets", "skipped", "Not needed for this template")
                publish("generate_code_snippets", "skipped", "Skipped")

            # ── STEP 5: generate_image_prompts ──────────────────────────
            publish("generate_image_prompts", "running", "Creating image prompts...")
            update_step(db, "generate_image_prompts", "running")

            n_images = 2 if template == "tech-dark" and code_snippets else 4
            raw = generate_text(
                f"Generate {n_images} image prompts for AI image generation about: {topic}. "
                "Style: cinematic, high quality, tech aesthetic. "
                f"Return ONLY a JSON array of {n_images} strings.",
                max_tokens=200,
            ).replace("```json", "").replace("```", "").strip()

            try:
                image_prompts = json.loads(raw)[:n_images]
            except Exception:
                image_prompts = [f"{topic}, cinematic lighting, tech aesthetic"] * n_images

            record_cost(db, "ollama", "generate_text", 0.0, model)
            update_step(db, "generate_image_prompts", "done",
                        f"{len(image_prompts)} prompts", {"prompts": image_prompts})
            publish("generate_image_prompts", "done",
                    f"{len(image_prompts)} prompts", {"prompts": image_prompts})

            # ── STEP 6: generate_images ─────────────────────────────────
            publish("generate_images", "running", "Generating images...")
            update_step(db, "generate_images", "running")

            import fal_client
            import requests as req
            os.environ["FAL_KEY"] = get_fal_api_key()
            fal_model = get_fal_model()
            images = []

            for i, prompt in enumerate(image_prompts):
                publish("generate_images", "running",
                        f"Image {i+1} of {len(image_prompts)}...")
                result = fal_client.run(
                    fal_model,
                    arguments={"prompt": prompt, "image_size": "portrait_16_9",
                               "num_inference_steps": 4, "num_images": 1,
                               "enable_safety_checker": False},
                )
                img_url = result["images"][0]["url"]
                img_data = req.get(img_url, timeout=60).content
                img_path = os.path.join(ROOT_DIR, ".mp", str(uuid.uuid4()) + ".png")
                with open(img_path, "wb") as f:
                    f.write(img_data)
                images.append(img_path)
                img_cost = record_cost(db, "fal_ai", "generate_image", 0.003,
                                       fal_model, {"prompt": prompt})
                total_cost += img_cost

            update_step(db, "generate_images", "done",
                        f"{len(images)} images", {"images": images})
            publish("generate_images", "done",
                    f"{len(images)} images ready", {"images": images})

            # ── STEP 7: synthesize_audio ────────────────────────────────
            publish("synthesize_audio", "running", "Synthesizing voice...")
            update_step(db, "synthesize_audio", "running")

            import edge_tts as _edge_tts
            tts_voice = VOICE_MAP.get(language, "en-US-JennyNeural")
            tts_path = os.path.join(ROOT_DIR, ".mp", str(uuid.uuid4()) + ".mp3")

            async def _synthesize():
                comm = _edge_tts.Communicate(script, tts_voice)
                await comm.save(tts_path)

            asyncio.run(_synthesize())
            record_cost(db, "edge_tts", "tts", 0.0, tts_voice, {"chars": len(script)})
            update_step(db, "synthesize_audio", "done",
                        f"Audio: {os.path.getsize(tts_path):,} bytes")
            publish("synthesize_audio", "done", "Audio ready")

            # ── STEP 8: generate_subtitles (word-level) ─────────────────
            publish("generate_subtitles", "running", "Transcribing with word timestamps...")
            update_step(db, "generate_subtitles", "running")

            from faster_whisper import WhisperModel
            wmodel = WhisperModel("base", device="cpu", compute_type="int8")
            whisper_lang = WHISPER_LANG_MAP.get(language, "en")
            segments, _ = wmodel.transcribe(
                tts_path, language=whisper_lang,
                vad_filter=True, word_timestamps=True,
            )

            subtitles = []
            for seg in segments:
                if seg.words:
                    for word in seg.words:
                        w = word.word.strip()
                        if w:
                            subtitles.append({
                                "word": w,
                                "start": round(word.start, 3),
                                "end": round(word.end, 3),
                            })

            record_cost(db, "whisper", "stt", 0.0, "whisper-base")
            update_step(db, "generate_subtitles", "done",
                        f"{len(subtitles)} words")
            publish("generate_subtitles", "done", f"{len(subtitles)} word timestamps")

            # ── STEP 9: render_video ────────────────────────────────────
            publish("render_video", "running", "Rendering with Remotion...")
            update_step(db, "render_video", "running")

            out_path = os.path.join(ROOT_DIR, ".mp", str(uuid.uuid4()) + ".mp4")

            render_props = {
                k: v for k, v in {
                    "template": template,
                    "resolution": resolution,
                    "script": script,
                    "subtitles": subtitles,
                    "audio_path": tts_path,
                    "images": images if images else None,
                    "code_snippets": code_snippets if code_snippets else None,
                    "music_track": music_track,
                    "music_volume": 0.12,
                    "language": language,
                    "output_path": out_path,
                    "fps": 30,
                }.items() if v is not None
            }

            import requests as req
            resp = req.post(
                f"{settings.remotion_service_url}/render",
                json=render_props,
                timeout=600,
            )
            resp.raise_for_status()
            render_result = resp.json()

            size_bytes = render_result.get("file_size_bytes", 0)
            duration_sec = render_result.get("duration_seconds", 0.0)

            update_step(db, "render_video", "done",
                        f"Video: {size_bytes/1024/1024:.1f} MB",
                        {"video_path": out_path, "size_bytes": size_bytes})
            publish("render_video", "done",
                    f"Video ready ({size_bytes/1024/1024:.1f} MB)",
                    {"video_path": out_path})

            # ── Save to DB ──────────────────────────────────────────────
            video = Video(
                job_id=job_id, account_id=account_id,
                title=title, description=description, script=script,
                file_path=out_path,
                duration_seconds=duration_sec,
                file_size_bytes=size_bytes,
            )
            db.add(video)
            db.flush()

            job.status = "done"
            job.finished_at = datetime.now(timezone.utc)
            job.result = {
                "video_path": out_path,
                "video_id": str(video.id),
                "total_cost_usd": total_cost,
            }
            db.commit()

            r.publish(f"job:{job_id}", json.dumps({
                "event": "job_done", "job_id": job_id,
                "video_path": out_path, "video_id": str(video.id),
                "total_cost_usd": total_cost,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }))

            return {"status": "done", "video_path": out_path, "total_cost_usd": total_cost}

        except Exception as exc:
            job.status = "failed"
            job.finished_at = datetime.now(timezone.utc)
            job.error = str(exc)
            db.commit()
            r.publish(f"job:{job_id}", json.dumps({
                "event": "job_failed", "job_id": job_id,
                "error": str(exc),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }))
            raise self.retry(exc=exc)
