"""
Celery task: generate a full YouTube Short.

Pipeline steps (in order):
  generate_topic → generate_script → generate_metadata →
  generate_image_prompts → generate_images → synthesize_audio →
  generate_subtitles → compose_video
"""
import asyncio
import os
import re
import json
import uuid
from datetime import datetime, timezone

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
    "English":    "en",
    "Spanish":    "es",
    "Portuguese": "pt",
    "French":     "fr",
    "German":     "de",
    "Italian":    "it",
    "Japanese":   "ja",
}

STEPS = [
    "web_search",
    "generate_topic",
    "generate_script",
    "generate_metadata",
    "generate_image_prompts",
    "generate_images",
    "synthesize_audio",
    "generate_subtitles",
    "compose_video",
    "upload_youtube",
]

DURATION_WORDS = {"30s": 75, "60s": 150, "90s": 225, "120s": 300}
DURATION_IMAGES = {"30s": 3,  "60s": 4,  "90s": 5,  "120s": 6}


def _run(coro):
    """Run async coroutine from sync Celery task."""
    return asyncio.get_event_loop().run_until_complete(coro)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30, name="youtube.generate_video")
def generate_video(
    self: Task,
    job_id: str,
    account_id: str,
    niche: str,
    language: str,
    topic: str | None = None,
    web_search_enabled: bool = False,
    duration_hint: str = "60s",
    auto_upload: bool = False,
) -> dict:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker, Session
    from backend.models.job import Job, PipelineStep
    from backend.models.video import Video
    from backend.models.cost import CostRecord
    from decimal import Decimal

    # Use sync engine inside Celery task
    sync_url = settings.database_url.replace("+asyncpg", "+psycopg2")

    try:
        from sqlalchemy import create_engine as _ce
        engine = _ce(sync_url)
        SessionLocal = sessionmaker(engine)
    except Exception:
        sync_url = settings.database_url.replace("+asyncpg", "")
        from sqlalchemy import create_engine as _ce
        engine = _ce(sync_url)
        SessionLocal = sessionmaker(engine)

    import redis as _redis
    r = _redis.from_url(settings.redis_url, decode_responses=True)

    def publish(step: str, status: str, detail: str = "", progress: int = 0, cost: float = 0.0, meta: dict = {}):
        payload = json.dumps({
            "event": "step_update",
            "job_id": job_id,
            "step": step,
            "status": status,
            "detail": detail,
            "progress": progress,
            "cost_usd": cost,
            "meta": meta,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        r.publish(f"job:{job_id}", payload)

    def update_step(db: Session, step: str, status: str, detail: str = "", meta: dict = {}):
        existing = db.query(PipelineStep).filter_by(job_id=job_id, step=step).first()
        if existing:
            existing.status = status
            existing.detail = detail
            existing.meta = meta
            if status == "running":
                existing.started_at = datetime.now(timezone.utc)
            elif status in ("done", "failed"):
                existing.finished_at = datetime.now(timezone.utc)
        db.commit()

    def record_cost(db: Session, service: str, operation: str, cost_usd: float, model: str = "", meta: dict = {}):
        record = CostRecord(
            job_id=job_id, service=service, operation=operation,
            cost_usd=Decimal(str(cost_usd)), model=model, meta=meta,
        )
        db.add(record)
        db.commit()
        return cost_usd

    with SessionLocal() as db:
        # Mark job as running, create pipeline steps
        job = db.get(Job, job_id)
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.error = None
        job.started_at = datetime.now(timezone.utc)
        job.celery_task_id = self.request.id
        db.commit()

        existing = db.query(PipelineStep).filter_by(job_id=job_id).count()
        if existing == 0:
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
            from utils import choose_random_song
            from config import get_fal_api_key, get_fal_model, ROOT_DIR, equalize_subtitles

            select_model((job.input or {}).get("model", "llama3.1:latest"))
            total_cost = 0.0
            os.makedirs(os.path.join(ROOT_DIR, ".mp"), exist_ok=True)

            target_words = DURATION_WORDS.get(duration_hint, 150)
            n_images = DURATION_IMAGES.get(duration_hint, 4)

            # ── STEP 1: web_search ──────────────────────────────────────
            search_context = ""
            search_query = topic or niche
            if web_search_enabled and settings.tavily_api_key:
                publish("web_search", "running", f"Searching: {search_query}...", 8)
                update_step(db, "web_search", "running")
                try:
                    import requests as _req
                    resp = _req.post(
                        "https://api.tavily.com/search",
                        json={
                            "api_key": settings.tavily_api_key,
                            "query": search_query,
                            "max_results": 5,
                            "search_depth": "basic",
                            "include_answer": True,
                        },
                        timeout=15,
                    )
                    data = resp.json()
                    results = data.get("results", [])
                    search_context = "\n\n".join(
                        f"Source: {r['title']}\n{r['content'][:500]}"
                        for r in results[:4]
                    )
                    detail = f"{len(results)} sources found"
                    update_step(db, "web_search", "done", detail, {"sources": len(results)})
                    publish("web_search", "done", detail, 12, 0.0, {"sources": len(results)})
                except Exception as e:
                    update_step(db, "web_search", "skipped", f"Search failed: {e}")
                    publish("web_search", "skipped", "Skipped (search unavailable)", 12)
            else:
                update_step(db, "web_search", "skipped", "Web search disabled")
                publish("web_search", "skipped", "Web search disabled", 12)

            context_block = (
                f"\n\nResearch context (use for accuracy):\n{search_context}"
                if search_context else ""
            )

            # ── STEP 2: generate_topic ──────────────────────────────────
            if topic:
                update_step(db, "generate_topic", "skipped", f"Topic provided: {topic}")
                publish("generate_topic", "skipped", f"Using: {topic}", 15)
            else:
                publish("generate_topic", "running", "Generating video topic...", 13)
                update_step(db, "generate_topic", "running")
                topic = generate_text(
                    f"Give me one YouTube Shorts video idea about: {niche}."
                    f"{context_block}\n"
                    "Return ONLY the idea, no intro text, no quotes.",
                    max_tokens=60,
                ).strip().strip('"')
                record_cost(db, "ollama", "generate_text", 0.0, "ollama", {"topic": topic})
                update_step(db, "generate_topic", "done", topic, {"topic": topic})
                publish("generate_topic", "done", topic, 15, 0.0, {"topic": topic})

            # ── STEP 3: generate_script ─────────────────────────────────
            publish("generate_script", "running", "Writing script...", 18)
            update_step(db, "generate_script", "running")

            script = generate_text(
                f"Write a {target_words}-word YouTube Shorts script about: {topic}. "
                f"Language: {language}. "
                f"Style: engaging, conversational, no filler words. "
                f"Return ONLY the script, no labels, no markdown.{context_block}",
                max_tokens=target_words * 2,
            )
            script = re.sub(r"\*", "", script).strip()
            update_step(db, "generate_script", "done", script[:100] + "...", {"script": script})
            publish("generate_script", "done", script[:80] + "...", 26, 0.0, {"script": script})

            # ── STEP 3: generate_metadata ───────────────────────────────
            publish("generate_metadata", "running", "Generating title & description...", 30)
            update_step(db, "generate_metadata", "running")

            title = generate_text(
                f"Generate a YouTube Short title with hashtags for: {topic}. "
                "Max 100 chars. Return ONLY the title.",
                max_tokens=60,
            )[:100]
            description = generate_text(
                f"Generate a YouTube description for this script: {script[:300]}. "
                "Return ONLY the description. Max 3 sentences.",
                max_tokens=150,
            )
            metadata = {"title": title, "description": description}
            update_step(db, "generate_metadata", "done", title, metadata)
            publish("generate_metadata", "done", title, 36, 0.0, metadata)

            # ── STEP 4: generate_image_prompts ──────────────────────────
            publish("generate_image_prompts", "running", "Creating image prompts...", 38)
            update_step(db, "generate_image_prompts", "running")

            raw = generate_text(
                f"Generate {n_images} image prompts for AI image generation about: {topic}. "
                f"Return ONLY a JSON array of {n_images} strings.",
                max_tokens=200,
            ).replace("```json", "").replace("```", "").strip()
            try:
                image_prompts = json.loads(raw)[:n_images]
            except Exception:
                image_prompts = [f"{topic}, cinematic lighting, vivid colors"] * n_images

            update_step(db, "generate_image_prompts", "done", f"{len(image_prompts)} prompts", {"prompts": image_prompts})
            publish("generate_image_prompts", "done", f"{len(image_prompts)} prompts ready", 44, 0.0, {"prompts": image_prompts})

            # ── STEP 5: generate_images ─────────────────────────────────
            publish("generate_images", "running", "Generating AI images...", 45)
            update_step(db, "generate_images", "running")

            import fal_client
            import requests as req
            os.environ["FAL_KEY"] = get_fal_api_key()
            fal_model = get_fal_model()
            images = []

            for i, prompt in enumerate(image_prompts):
                detail = f"Image {i+1} of {len(image_prompts)}..."
                publish("generate_images", "running", detail, 45 + i * 5)
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
                img_cost = record_cost(db, "fal_ai", "generate_image", 0.003, fal_model, {"prompt": prompt, "url": img_url})
                total_cost += img_cost

            update_step(db, "generate_images", "done", f"{len(images)} images generated", {"images": images})
            publish("generate_images", "done", f"{len(images)} images ready", 60, total_cost, {"images": images})

            # ── STEP 6: synthesize_audio ────────────────────────────────
            publish("synthesize_audio", "running", "Synthesizing voice...", 62)
            update_step(db, "synthesize_audio", "running")

            import edge_tts as _edge_tts
            import asyncio as _asyncio

            tts_voice = VOICE_MAP.get(language, "en-US-JennyNeural")
            tts_path = os.path.join(ROOT_DIR, ".mp", str(uuid.uuid4()) + ".mp3")

            async def _synthesize():
                comm = _edge_tts.Communicate(script, tts_voice)
                await comm.save(tts_path)

            _asyncio.run(_synthesize())
            record_cost(db, "edge_tts", "tts", 0.0, tts_voice, {"chars": len(script), "voice": tts_voice})

            update_step(db, "synthesize_audio", "done", f"Audio: {os.path.getsize(tts_path):,} bytes")
            publish("synthesize_audio", "done", "Audio synthesized", 70)

            # ── STEP 7: generate_subtitles ──────────────────────────────
            publish("generate_subtitles", "running", "Transcribing audio (Whisper)...", 72)
            update_step(db, "generate_subtitles", "running")

            from faster_whisper import WhisperModel
            wmodel = WhisperModel("base", device="cpu", compute_type="int8")
            whisper_lang = WHISPER_LANG_MAP.get(language, "en")
            segments, _ = wmodel.transcribe(tts_path, vad_filter=True, language=whisper_lang)

            def fmt_ts(s):
                ms = max(0, int(round(s * 1000)))
                return f"{ms//3600000:02d}:{(ms%3600000)//60000:02d}:{(ms%60000)//1000:02d},{ms%1000:03d}"

            lines = []
            for idx, seg in enumerate(segments, 1):
                text = str(seg.text).strip()
                if text:
                    lines += [str(idx), f"{fmt_ts(seg.start)} --> {fmt_ts(seg.end)}", text, ""]

            srt_path = os.path.join(ROOT_DIR, ".mp", str(uuid.uuid4()) + ".srt")
            with open(srt_path, "w") as f:
                f.write("\n".join(lines))
            equalize_subtitles(srt_path, 10)
            record_cost(db, "whisper", "stt", 0.0, "whisper-base")

            update_step(db, "generate_subtitles", "done", "Subtitles generated")
            publish("generate_subtitles", "done", "Subtitles ready", 80)

            # ── STEP 8: compose_video ───────────────────────────────────
            publish("compose_video", "running", "Composing final video...", 82)
            update_step(db, "compose_video", "running")

            from moviepy.editor import (
                ImageClip, AudioFileClip, concatenate_videoclips,
                CompositeVideoClip, CompositeAudioClip, TextClip,
            )
            from moviepy.video.fx.all import crop
            from moviepy.config import change_settings as mpy_settings
            from moviepy.video.tools.subtitles import SubtitlesClip
            from moviepy.audio.fx.all import volumex
            from config import get_imagemagick_path, get_threads, get_font, get_fonts_dir

            mpy_settings({"IMAGEMAGICK_BINARY": get_imagemagick_path()})

            tts_clip = AudioFileClip(tts_path)
            max_duration = tts_clip.duration
            req_dur = max_duration / len(images)

            generator = lambda txt: TextClip(
                txt, font=os.path.join(get_fonts_dir(), get_font()),
                fontsize=100, color="#FFFF00", stroke_color="black",
                stroke_width=5, size=(1080, 1920), method="caption",
            )

            clips, tot_dur = [], 0
            while tot_dur < max_duration:
                for img_path in images:
                    clip = ImageClip(img_path).set_duration(req_dur).set_fps(30)
                    if round((clip.w / clip.h), 4) < 0.5625:
                        clip = crop(clip, width=clip.w, height=round(clip.w / 0.5625),
                                    x_center=clip.w / 2, y_center=clip.h / 2)
                    else:
                        clip = crop(clip, width=round(0.5625 * clip.h), height=clip.h,
                                    x_center=clip.w / 2, y_center=clip.h / 2)
                    clip = clip.resize((1080, 1920))
                    clips.append(clip)
                    tot_dur += clip.duration

            final_clip = concatenate_videoclips(clips).set_fps(30)
            song_path = choose_random_song(fallback_duration=max_duration)
            song_clip = AudioFileClip(song_path).set_fps(44100).fx(volumex, 0.1)
            comp_audio = CompositeAudioClip([tts_clip.set_fps(44100), song_clip])
            final_clip = final_clip.set_audio(comp_audio).set_duration(tts_clip.duration)
            subtitles = SubtitlesClip(srt_path, generator)
            final_clip = CompositeVideoClip([final_clip, subtitles])

            out_path = os.path.join(ROOT_DIR, ".mp", str(uuid.uuid4()) + ".mp4")
            final_clip.write_videofile(out_path, threads=get_threads(), logger=None)

            size_bytes = os.path.getsize(out_path)
            update_step(db, "compose_video", "done", f"Video: {size_bytes/1024/1024:.1f} MB",
                        {"video_path": out_path, "size_bytes": size_bytes})
            publish("compose_video", "done", f"Video ready ({size_bytes/1024/1024:.1f} MB)", 98,
                    total_cost, {"video_path": out_path})

            # ── Save video to DB ────────────────────────────────────────
            video = Video(
                job_id=job_id, account_id=account_id,
                title=title, description=description, script=script,
                file_path=out_path, duration_seconds=max_duration,
                file_size_bytes=size_bytes,
            )
            db.add(video)
            db.flush()
            video_id_str = str(video.id)

            # ── STEP 9: upload_youtube ──────────────────────────────────
            youtube_url = None
            if auto_upload:
                publish("upload_youtube", "running", "Opening Firefox to upload...", 99)
                update_step(db, "upload_youtube", "running")
                try:
                    from backend.models.account import Account as _Account
                    account = db.get(_Account, uuid.UUID(account_id))
                    profile_path = account.firefox_profile_path if account else None
                    if not profile_path:
                        raise RuntimeError("Account has no Firefox profile. Connect the account first.")

                    from selenium import webdriver
                    from selenium.webdriver.firefox.options import Options
                    from selenium.webdriver.firefox.service import Service
                    from selenium.webdriver.common.by import By
                    from selenium.webdriver.common.keys import Keys
                    from webdriver_manager.firefox import GeckoDriverManager
                    import time as _time

                    opts = Options()
                    opts.add_argument("-profile")
                    opts.add_argument(profile_path)
                    _svc_env = os.environ.copy()
                    _svc_env.setdefault("DISPLAY", ":0")
                    _svc_env.setdefault("DRI_PRIME", "1")
                    service = Service(GeckoDriverManager().install(), env=_svc_env)
                    driver = webdriver.Firefox(service=service, options=opts)

                    try:
                        driver.get("https://www.youtube.com/upload")
                        _time.sleep(3)

                        file_input = driver.find_element(By.TAG_NAME, "ytcp-uploads-file-picker").find_element(By.TAG_NAME, "input")
                        file_input.send_keys(out_path)
                        publish("upload_youtube", "running", "Uploading file...", 99)
                        _time.sleep(8)

                        textboxes = driver.find_elements(By.ID, "textbox")
                        textboxes[0].click(); _time.sleep(0.5)
                        textboxes[0].send_keys(Keys.CONTROL + "a")
                        textboxes[0].send_keys(Keys.DELETE)
                        textboxes[0].send_keys(title)
                        _time.sleep(10)
                        textboxes[-1].click(); _time.sleep(0.5)
                        textboxes[-1].send_keys(Keys.CONTROL + "a")
                        textboxes[-1].send_keys(Keys.DELETE)
                        textboxes[-1].send_keys(description)
                        _time.sleep(0.5)

                        driver.find_element(By.NAME, "VIDEO_MADE_FOR_KIDS_NOT_MFK").click()
                        _time.sleep(0.5)

                        for _ in range(3):
                            driver.find_element(By.ID, "next-button").click()
                            _time.sleep(2)

                        radio_buttons = driver.find_elements(By.XPATH, '//*[@id="radioLabel"]')
                        radio_buttons[2].click()  # unlisted
                        _time.sleep(0.5)

                        driver.find_element(By.ID, "done-button").click()
                        _time.sleep(3)

                        # Grab URL from Studio
                        from sqlalchemy import text as _sql_text
                        channel_id_result = driver.current_url  # fallback
                        driver.get("https://studio.youtube.com")
                        _time.sleep(2)
                        channel_id = driver.current_url.rstrip("/").split("/")[-1]
                        driver.get(f"https://studio.youtube.com/channel/{channel_id}/videos/short")
                        _time.sleep(3)
                        rows = driver.find_elements(By.TAG_NAME, "ytcp-video-row")
                        if rows:
                            href = rows[0].find_element(By.TAG_NAME, "a").get_attribute("href")
                            vid_id = href.split("/")[-2]
                            youtube_url = f"https://www.youtube.com/shorts/{vid_id}"
                    finally:
                        driver.quit()

                    video.youtube_url = youtube_url
                    db.commit()
                    update_step(db, "upload_youtube", "done", youtube_url or "Uploaded", {"youtube_url": youtube_url})
                    publish("upload_youtube", "done", youtube_url or "Uploaded", 100, 0.0, {"youtube_url": youtube_url})

                except Exception as exc:
                    update_step(db, "upload_youtube", "failed", str(exc))
                    publish("upload_youtube", "failed", f"Upload failed: {exc}", 100)
            else:
                update_step(db, "upload_youtube", "skipped", "Auto-upload disabled")
                publish("upload_youtube", "skipped", "Auto-upload disabled", 100)

            job.status = "done"
            job.finished_at = datetime.now(timezone.utc)
            job.result = {
                "video_path": out_path,
                "video_id": video_id_str,
                "total_cost_usd": total_cost,
                "youtube_url": youtube_url,
            }
            db.commit()

            r.publish(f"job:{job_id}", json.dumps({
                "event": "job_done", "job_id": job_id,
                "video_path": out_path, "video_id": video_id_str,
                "total_cost_usd": total_cost,
                "youtube_url": youtube_url,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }))

            return {"status": "done", "video_path": out_path, "total_cost_usd": total_cost, "youtube_url": youtube_url}

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


@celery_app.task(bind=True, max_retries=1, default_retry_delay=10, name="youtube.upload_video_only")
def upload_video_only(self, job_id: str) -> dict:
    """Upload an already-rendered video to YouTube."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from selenium import webdriver
    from selenium.webdriver.firefox.options import Options
    from selenium.webdriver.firefox.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from webdriver_manager.firefox import GeckoDriverManager
    import time as _time

    sync_url = settings.database_url.replace("+asyncpg", "+psycopg2")
    try:
        engine = create_engine(sync_url)
    except Exception:
        engine = create_engine(settings.database_url.replace("+asyncpg", ""))
    SessionLocal = sessionmaker(engine)

    import redis as _redis
    r = _redis.from_url(settings.redis_url, decode_responses=True)

    def publish(status: str, detail: str = "", progress: int = 0):
        r.publish(f"job:{job_id}", json.dumps({
            "event": "step_update", "job_id": job_id,
            "step": "upload_youtube", "status": status,
            "detail": detail, "progress": progress,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }))

    driver = None
    with SessionLocal() as db:
        try:
            from backend.models.job import Job, PipelineStep
            from backend.models.video import Video
            from backend.models.account import Account

            job = db.get(Job, job_id)
            if not job or not job.result:
                raise RuntimeError("Job or result not found")

            video_path = job.result.get("video_path")
            if not video_path or not os.path.exists(video_path):
                raise RuntimeError(f"Video file not found: {video_path}")

            account = db.get(Account, uuid.UUID(str(job.account_id)))
            if not account or not account.firefox_profile_path:
                raise RuntimeError("Account has no Firefox profile. Connect the account first.")

            video_rec = db.query(Video).filter_by(job_id=job_id).first()
            title = (video_rec.title if video_rec else None) or (job.result.get("title")) or "YouTube Short"
            description = (video_rec.description if video_rec else None) or ""

            publish("running", "Opening Firefox...", 10)

            opts = Options()
            opts.add_argument("-profile")
            opts.add_argument(account.firefox_profile_path)
            _svc_env = os.environ.copy()
            _svc_env.setdefault("DISPLAY", ":0")
            _svc_env.setdefault("DRI_PRIME", "1")
            service = Service(GeckoDriverManager().install(), env=_svc_env)
            driver = webdriver.Firefox(service=service, options=opts)

            driver.get("https://www.youtube.com/upload")
            _time.sleep(3)

            publish("running", "Uploading file...", 30)
            file_input = driver.find_element(By.TAG_NAME, "ytcp-uploads-file-picker").find_element(By.TAG_NAME, "input")
            file_input.send_keys(video_path)
            _time.sleep(8)

            publish("running", "Setting title & description...", 60)
            textboxes = driver.find_elements(By.ID, "textbox")
            textboxes[0].click(); _time.sleep(0.5)
            textboxes[0].send_keys(Keys.CONTROL + "a")
            textboxes[0].send_keys(Keys.DELETE)
            textboxes[0].send_keys(title)
            _time.sleep(10)
            textboxes[-1].click(); _time.sleep(0.5)
            textboxes[-1].send_keys(Keys.CONTROL + "a")
            textboxes[-1].send_keys(Keys.DELETE)
            textboxes[-1].send_keys(description)
            _time.sleep(0.5)

            driver.find_element(By.NAME, "VIDEO_MADE_FOR_KIDS_NOT_MFK").click()
            _time.sleep(0.5)

            for _ in range(3):
                driver.find_element(By.ID, "next-button").click()
                _time.sleep(2)

            radio_buttons = driver.find_elements(By.XPATH, '//*[@id="radioLabel"]')
            radio_buttons[2].click()
            _time.sleep(0.5)

            driver.find_element(By.ID, "done-button").click()
            _time.sleep(3)

            driver.get("https://studio.youtube.com")
            _time.sleep(2)
            channel_id = driver.current_url.rstrip("/").split("/")[-1]
            driver.get(f"https://studio.youtube.com/channel/{channel_id}/videos/short")
            _time.sleep(3)
            rows = driver.find_elements(By.TAG_NAME, "ytcp-video-row")
            youtube_url = None
            if rows:
                href = rows[0].find_element(By.TAG_NAME, "a").get_attribute("href")
                vid_id = href.split("/")[-2]
                youtube_url = f"https://www.youtube.com/shorts/{vid_id}"

            if video_rec:
                video_rec.youtube_url = youtube_url
            job.result = {**(job.result or {}), "youtube_url": youtube_url}
            db.commit()

            existing_step = db.query(PipelineStep).filter_by(job_id=job_id, step="upload_youtube").first()
            if existing_step:
                existing_step.status = "done"
                existing_step.detail = youtube_url or "Uploaded"
                existing_step.finished_at = datetime.now(timezone.utc)
                db.commit()

            publish("done", youtube_url or "Uploaded", 100)
            r.publish(f"job:{job_id}", json.dumps({
                "event": "job_done", "job_id": job_id,
                "youtube_url": youtube_url,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }))
            return {"status": "done", "youtube_url": youtube_url}

        except Exception as exc:
            publish("failed", str(exc), 100)
            raise self.retry(exc=exc)
        finally:
            if driver:
                try:
                    driver.quit()
                except Exception:
                    pass
