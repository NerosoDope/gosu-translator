"""
Job Router - API endpoints

Author: GOSU Development Team
Version: 1.0.0
"""

import io
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.db.session import get_db
from app.modules.job.schemas import *
from app.modules.job.service import JobService

router = APIRouter()


@router.get("")
async def list_job(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    query: Optional[str] = Query(None, description="Tìm theo mã job"),
    status: Optional[str] = Query(None, description="Lọc theo trạng thái"),
    job_type: Optional[str] = Query(None, description="Lọc theo loại job"),
    user_id: Optional[int] = Query(None, description="Lọc theo người tạo (Jobs của tôi)"),
    sort_by: str = Query("id", description="Sắp xếp theo cột"),
    sort_order: str = Query("asc", description="asc | desc"),
    db: AsyncSession = Depends(get_db),
):
    """List Job - Lấy danh sách có phân trang, tìm kiếm, lọc."""
    service = JobService(db)
    return await service.list(
        skip=skip,
        limit=limit,
        query=query,
        status=status,
        job_type=job_type,
        user_id=user_id,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/export/excel")
async def export_job_excel(
    query: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Export danh sách job ra file Excel."""
    service = JobService(db)
    try:
        excel_bytes = await service.export_excel(query=query, status=status, job_type=job_type, user_id=user_id)
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="openpyxl module is not installed on the server.",
        )
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="jobs_export.xlsx"'},
    )


@router.get("/{id}", response_model=dict)
async def get_job(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get Job - Lấy chi tiết"""
    service = JobService(db)
    item = await service.get(id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_job(
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Create Job - Tạo mới"""
    service = JobService(db)
    return await service.create(data)


@router.put("/{id}", response_model=dict)
async def update_job(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Update Job - Cập nhật"""
    service = JobService(db)
    item = await service.update(id, data)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete Job - Xóa"""
    service = JobService(db)
    success = await service.delete(id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return None
