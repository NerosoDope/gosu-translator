"""
Job Repository - Data access layer

Author: GOSU Development Team
Version: 1.0.0
"""

from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from app.modules.job.models import Job
from app.modules.users.models import User


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
        sort_by: str = "id",
        sort_order: str = "asc",
    ):
        """Build query joining Job with User to get creator name."""
        q = (
            select(Job, User.full_name.label("creator_name"))
            .select_from(Job)
            .outerjoin(User, Job.user_id == User.id)
        )
        if query_str and query_str.strip():
            term = f"%{query_str.strip()}%"
            q = q.where(Job.job_code.ilike(term))
        if status:
            q = q.where(Job.status == status)
        if job_type:
            q = q.where(Job.job_type == job_type)
        if user_id is not None:
            q = q.where(Job.user_id == user_id)
        order_col = getattr(Job, sort_by, Job.id)
        q = q.order_by(order_col.desc() if sort_order == "desc" else order_col.asc())
        return q

    def _build_list_query(
        self,
        query_str: Optional[str] = None,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        user_id: Optional[int] = None,
        sort_by: str = "id",
        sort_order: str = "asc",
    ):
        """Build base query with filters and order (Job only, for count)."""
        q = select(Job)
        if query_str and query_str.strip():
            term = f"%{query_str.strip()}%"
            q = q.where(Job.job_code.ilike(term))
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

    async def list(
        self,
        skip: int = 0,
        limit: int = 20,
        query_str: Optional[str] = None,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        user_id: Optional[int] = None,
        sort_by: str = "id",
        sort_order: str = "asc",
    ) -> Tuple[List[Dict[str, Any]], int]:
        """List job with filters and return (items, total). Items include creator_name."""
        base = self._job_with_creator_query(query_str, status, job_type, user_id, sort_by, sort_order)
        count_q = select(func.count()).select_from(Job)
        if query_str and query_str.strip():
            count_q = count_q.where(Job.job_code.ilike(f"%{query_str.strip()}%"))
        if status:
            count_q = count_q.where(Job.status == status)
        if job_type:
            count_q = count_q.where(Job.job_type == job_type)
        if user_id is not None:
            count_q = count_q.where(Job.user_id == user_id)
        total = (await self.db.execute(count_q)).scalar() or 0
        result = await self.db.execute(base.offset(skip).limit(limit))
        rows = result.all()
        return [self._row_to_item(r) for r in rows], total

    async def list_all(
        self,
        query_str: Optional[str] = None,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        user_id: Optional[int] = None,
        sort_by: str = "id",
        sort_order: str = "asc",
        limit: int = 100000,
    ) -> List[Dict[str, Any]]:
        """List all jobs for export (no pagination). Items include creator_name."""
        base = self._job_with_creator_query(query_str, status, job_type, user_id, sort_by, sort_order)
        result = await self.db.execute(base.limit(limit))
        rows = result.all()
        return [self._row_to_item(r) for r in rows]
    
    async def get(self, id: int) -> Optional[Dict[str, Any]]:
        """Get job by ID. Returns dict with creator_name."""
        q = (
            select(Job, User.full_name.label("creator_name"))
            .select_from(Job)
            .outerjoin(User, Job.user_id == User.id)
            .where(Job.id == id)
        )
        result = await self.db.execute(q)
        row = result.one_or_none()
        if not row:
            return None
        return self._row_to_item(row)
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create job"""
        item = Job(**data)
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item.to_dict()
    
    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update job"""
        result = await self.db.execute(select(Job).where(Job.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return None
        for key, value in data.items():
            setattr(item, key, value)
        await self.db.commit()
        await self.db.refresh(item)
        return item.to_dict()
    
    async def delete(self, id: int) -> bool:
        """Delete job"""
        result = await self.db.execute(select(Job).where(Job.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True
