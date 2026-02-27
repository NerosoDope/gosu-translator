"""
Job Priority Worker - Background worker xử lý jobs theo thứ tự ưu tiên.

Cách hoạt động:
  - Mỗi POLL_INTERVAL giây, lấy 1 job pending có priority cao nhất
    (ORDER BY priority DESC, created_at ASC).
  - Chạy bản dịch và cập nhật trạng thái: pending → in_progress → completed/failed.
  - Chỉ xử lý job_type='translation' có payload.text.
  - Nếu job bị cancel trong lúc dịch, bỏ qua bước cập nhật completed.

Author: GOSU Development Team
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.modules.job.models import Job
from app.modules.job.state_machine import JobStatus
from app.modules.translate.service import translate_with_priority

logger = logging.getLogger(__name__)

POLL_INTERVAL = 2  # giây kiểm tra job mới khi hàng chờ rỗng


async def _process_job(job_id: int) -> None:
    """
    Xử lý một job dịch thuật:
      1. Kiểm tra job vẫn pending (tránh race condition).
      2. Cập nhật → in_progress.
      3. Gọi translate_with_priority (cache → glossary → AI).
      4. Cập nhật → completed hoặc failed.
    """
    async with AsyncSessionLocal() as db:
        # Bước 1: Fetch job, kiểm tra vẫn pending
        result = await db.execute(select(Job).where(Job.id == job_id))
        item = result.scalar_one_or_none()

        if not item or item.status != JobStatus.PENDING:
            return  # bị cancel hoặc đã xử lý bởi worker khác

        payload = dict(item.payload or {})

        # Bước 2: pending → in_progress
        item.status = JobStatus.IN_PROGRESS
        item.started_at = datetime.now(timezone.utc)
        item.progress = 0
        await db.commit()

        logger.info(
            f"[Worker] Job {job_id} ({item.job_code}) started "
            f"(priority={item.priority}, type={item.job_type})"
        )

        # Bước 3: Dịch thuật
        try:
            translated = await translate_with_priority(
                db=db,
                text=payload.get("text", ""),
                source_lang=payload.get("source_lang", ""),
                target_lang=payload.get("target_lang", ""),
                prompt_id=payload.get("prompt_id"),
                context=payload.get("context"),
                style=payload.get("style"),
            )

            # Bước 4a: in_progress → completed (re-fetch để kiểm tra cancel)
            result2 = await db.execute(select(Job).where(Job.id == job_id))
            item2 = result2.scalar_one_or_none()
            if item2 and item2.status == JobStatus.IN_PROGRESS:
                item2.status = JobStatus.COMPLETED
                item2.progress = 100
                item2.finished_at = datetime.now(timezone.utc)
                item2.result = {"translated": translated}
                await db.commit()
                logger.info(f"[Worker] Job {job_id} completed successfully")

        except Exception as e:
            logger.error(f"[Worker] Job {job_id} failed: {e}", exc_info=True)

            # Bước 4b: in_progress → failed
            try:
                result3 = await db.execute(select(Job).where(Job.id == job_id))
                item3 = result3.scalar_one_or_none()
                if item3 and item3.status == JobStatus.IN_PROGRESS:
                    item3.status = JobStatus.FAILED
                    item3.finished_at = datetime.now(timezone.utc)
                    item3.error_message = str(e)[:2000]
                    await db.commit()
            except Exception as inner_e:
                logger.error(
                    f"[Worker] Could not update job {job_id} to failed: {inner_e}"
                )


async def job_worker_loop() -> None:
    """
    Main loop của worker:
      - Liên tục lấy job pending có priority cao nhất và xử lý.
      - Nếu không có job, ngủ POLL_INTERVAL giây rồi kiểm tra lại.
      - Chỉ xử lý job_type='translation' với payload.text hợp lệ.
    """
    logger.info("[Worker] Job priority worker starting...")
    await asyncio.sleep(5)  # chờ app khởi động xong
    logger.info("[Worker] Job priority worker is running")

    while True:
        try:
            async with AsyncSessionLocal() as db:
                q = (
                    select(Job)
                    .where(Job.status == JobStatus.PENDING)
                    .where(Job.job_type == "translation")
                    .where(Job.deleted_at.is_(None))
                    .order_by(Job.created_at.asc())
                    .limit(1)
                )
                result = await db.execute(q)
                job = result.scalar_one_or_none()

            if job:
                payload = job.payload or {}
                if payload.get("text", "").strip():
                    await _process_job(job.id)
                else:
                    # payload rỗng, đánh dấu failed
                    async with AsyncSessionLocal() as db:
                        result = await db.execute(
                            select(Job).where(Job.id == job.id)
                        )
                        item = result.scalar_one_or_none()
                        if item and item.status == JobStatus.PENDING:
                            item.status = JobStatus.FAILED
                            item.finished_at = datetime.now(timezone.utc)
                            item.error_message = "Payload không có nội dung văn bản để dịch."
                            await db.commit()
            else:
                await asyncio.sleep(POLL_INTERVAL)

        except Exception as e:
            logger.error(
                f"[Worker] Unexpected error in worker loop: {e}", exc_info=True
            )
            await asyncio.sleep(POLL_INTERVAL)
