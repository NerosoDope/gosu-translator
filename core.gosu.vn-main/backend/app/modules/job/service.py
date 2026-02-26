"""
Job Service - Business logic

Author: GOSU Development Team
Version: 1.0.0
"""

import io
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.job.repository import JobRepository


class JobService:
    """Job Service - Business logic cho job"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = JobRepository(db)
    
    async def list(
        self,
        skip: int = 0,
        limit: int = 20,
        query: Optional[str] = None,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        user_id: Optional[int] = None,
        sort_by: str = "id",
        sort_order: str = "asc",
    ) -> Dict[str, Any]:
        """List job with filters and pagination. Returns { items, total, page, per_page, pages }."""
        items, total = await self.repo.list(
            skip=skip,
            limit=limit,
            query_str=query,
            status=status,
            job_type=job_type,
            user_id=user_id,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        pages = (total + limit - 1) // limit if limit else 0
        page = (skip // limit) + 1 if limit else 1
        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": limit,
            "pages": pages,
        }

    async def export_excel(
        self,
        query: Optional[str] = None,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> bytes:
        """Export jobs to Excel. Returns bytes of .xlsx file."""
        try:
            import openpyxl
        except ImportError:
            raise
        items = await self.repo.list_all(
            query_str=query, status=status, job_type=job_type, user_id=user_id, limit=100000
        )
        workbook = openpyxl.Workbook()
        worksheet = workbook.active
        worksheet.title = "Jobs"
        headers = [
            "id", "job_code", "job_type", "status", "priority", "user_id", "creator_name", "team_id", "game_id",
            "game_genre", "source_lang", "target_lang", "progress", "retry_count", "max_retry",
            "error_message", "created_at", "started_at", "finished_at",
        ]
        worksheet.append(headers)
        for item in items:
            worksheet.append([
                item.get("id"),
                item.get("job_code"),
                item.get("job_type"),
                item.get("status"),
                item.get("priority"),
                item.get("user_id"),
                item.get("creator_name"),
                item.get("team_id"),
                item.get("game_id"),
                item.get("game_genre"),
                item.get("source_lang"),
                item.get("target_lang"),
                item.get("progress"),
                item.get("retry_count"),
                item.get("max_retry"),
                item.get("error_message"),
                str(item.get("created_at")) if item.get("created_at") else None,
                str(item.get("started_at")) if item.get("started_at") else None,
                str(item.get("finished_at")) if item.get("finished_at") else None,
            ])
        output = io.BytesIO()
        workbook.save(output)
        output.seek(0)
        return output.read()
    
    async def get(self, id: int) -> Optional[Dict[str, Any]]:
        """Get job by ID"""
        return await self.repo.get(id)
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create job"""
        return await self.repo.create(data)
    
    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update job"""
        return await self.repo.update(id, data)
    
    async def delete(self, id: int) -> bool:
        """Delete job"""
        return await self.repo.delete(id)
