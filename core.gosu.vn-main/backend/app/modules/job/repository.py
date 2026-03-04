"""
Job Repository - Data access layer

Author: GOSU Development Team
Version: 1.0.0
"""

from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.modules.job.models import Job
from app.modules.job.state_machine import validate_transition, JobStatus
from app.modules.users.models import User


def _apply_transition_side_effects(item, new_status: str) -> None:
    """Tự động set timestamp khi chuyển trạng thái."""
    now = datetime.now(timezone.utc)
    if new_status == JobStatus.IN_PROGRESS:
        if item.started_at is None:
            item.started_at = now
    elif new_status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED):
        item.finished_at = now
        if new_status == JobStatus.COMPLETED and (item.progress or 0) < 100:
            item.progress = 100


class JobRepository:
    """Job Repository - Data access cho job"""

    def __init__(self, db: AsyncSession):
        self.db = db

    def _job_with_creator_query(
        self,
        query_str: Optional[str] = None,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        user_id: Optional[int] = None,
        include_deleted: bool = False,
        sort_by: str = "id",
        sort_order: str = "asc",
    ):
        """Build query joining Job with User to get creator name."""
        q = (
            select(Job, User.full_name.label("creator_name"))
            .select_from(Job)
            .outerjoin(User, Job.user_id == User.id)
        )
        if not include_deleted:
            q = q.where(Job.deleted_at.is_(None))
        if query_str and query_str.strip():
            q = q.where(Job.job_code.ilike(f"%{query_str.strip()}%"))
        if status:
            q = q.where(Job.status == status)
        if job_type:
            q = q.where(Job.job_type == job_type)
        if user_id is not None:
            q = q.where(Job.user_id == user_id)
        order_col = getattr(Job, sort_by, Job.id)
        q = q.order_by(order_col.desc() if sort_order == "desc" else order_col.asc())
        return q

    def _row_to_item(self, row) -> Dict[str, Any]:
        """Convert (Job, creator_name) row to dict with creator_name."""
        job, creator_name = row[0], row[1]
        d = job.to_dict()
        d["creator_name"] = creator_name or None
        return d

    def _count_query(
        self,
        query_str: Optional[str] = None,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        user_id: Optional[int] = None,
        include_deleted: bool = False,
    ):
        q = select(func.count()).select_from(Job)
        if not include_deleted:
            q = q.where(Job.deleted_at.is_(None))
        if query_str and query_str.strip():
            q = q.where(Job.job_code.ilike(f"%{query_str.strip()}%"))
        if status:
            q = q.where(Job.status == status)
        if job_type:
            q = q.where(Job.job_type == job_type)
        if user_id is not None:
            q = q.where(Job.user_id == user_id)
        return q

    async def list(
        self,
        skip: int = 0,
        limit: int = 20,
        query_str: Optional[str] = None,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        user_id: Optional[int] = None,
        include_deleted: bool = False,
        sort_by: str = "id",
        sort_order: str = "asc",
    ) -> Tuple[List[Dict[str, Any]], int]:
        base = self._job_with_creator_query(query_str, status, job_type, user_id, include_deleted, sort_by, sort_order)
        count_q = self._count_query(query_str, status, job_type, user_id, include_deleted)
        total = (await self.db.execute(count_q)).scalar() or 0
        result = await self.db.execute(base.offset(skip).limit(limit))
        return [self._row_to_item(r) for r in result.all()], total

    async def list_all(
        self,
        query_str: Optional[str] = None,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        user_id: Optional[int] = None,
        include_deleted: bool = False,
        sort_by: str = "id",
        sort_order: str = "asc",
        limit: int = 100000,
    ) -> List[Dict[str, Any]]:
        base = self._job_with_creator_query(query_str, status, job_type, user_id, include_deleted, sort_by, sort_order)
        result = await self.db.execute(base.limit(limit))
        return [self._row_to_item(r) for r in result.all()]

    async def get(self, id: int, include_deleted: bool = False) -> Optional[Dict[str, Any]]:
        q = (
            select(Job, User.full_name.label("creator_name"))
            .select_from(Job)
            .outerjoin(User, Job.user_id == User.id)
            .where(Job.id == id)
        )
        if not include_deleted:
            q = q.where(Job.deleted_at.is_(None))
        result = await self.db.execute(q)
        row = result.one_or_none()
        return self._row_to_item(row) if row else None

    async def _get_raw(self, id: int, include_deleted: bool = False) -> Optional[Job]:
        q = select(Job).where(Job.id == id)
        if not include_deleted:
            q = q.where(Job.deleted_at.is_(None))
        return (await self.db.execute(q)).scalar_one_or_none()

    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        item = Job(**data)
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item.to_dict()

    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        item = await self._get_raw(id)
        if not item:
            return None
        # Kiểm tra state machine nếu status thay đổi
        new_status = data.get("status")
        if new_status and new_status != item.status:
            validate_transition(item.status, new_status)
            _apply_transition_side_effects(item, new_status)
        for key, value in data.items():
            setattr(item, key, value)
        await self.db.commit()
        await self.db.refresh(item)
        return item.to_dict()

    async def delete(self, id: int) -> bool:
        """Soft delete: đặt deleted_at = now()."""
        item = await self._get_raw(id)
        if not item:
            return False
        item.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True

    async def restore(self, id: int) -> Optional[Dict[str, Any]]:
        """Khôi phục job đã bị soft-delete."""
        item = await self._get_raw(id, include_deleted=True)
        if not item:
            return None
        item.deleted_at = None
        await self.db.commit()
        await self.db.refresh(item)
        return item.to_dict()

    async def hard_delete(self, id: int) -> bool:
        """Xóa vĩnh viễn khỏi DB (kể cả đã soft-delete)."""
        item = await self._get_raw(id, include_deleted=True)
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True

    async def cancel(self, id: int) -> Optional[Dict[str, Any]]:
        """Hủy job — state machine: pending/in_progress → cancelled."""
        item = await self._get_raw(id)
        if not item:
            return None
        validate_transition(item.status, JobStatus.CANCELLED)
        item.status = JobStatus.CANCELLED
        item.finished_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(item)
        return item.to_dict()

    async def retry(self, id: int) -> Optional[Dict[str, Any]]:
        """Thử lại job — state machine: failed/cancelled → pending."""
        item = await self._get_raw(id)
        if not item:
            return None
        current_retry = item.retry_count or 0
        max_retry = item.max_retry or 0
        if max_retry > 0 and current_retry >= max_retry:
            raise ValueError(
                f"Job đã đạt giới hạn thử lại tối đa ({max_retry} lần). "
                "Không thể thử lại thêm."
            )
        validate_transition(item.status, JobStatus.PENDING)
        item.status = JobStatus.PENDING
        item.error_message = None
        item.started_at = None
        item.finished_at = None
        item.retry_count = current_retry + 1
        await self.db.commit()
        await self.db.refresh(item)
        return item.to_dict()
