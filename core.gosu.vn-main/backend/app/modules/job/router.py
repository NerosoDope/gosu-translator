"""
Job Router - API endpoints

Author: GOSU Development Team
Version: 1.0.0
"""

import io
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.db.session import get_db
from app.modules.job.schemas import *
from app.modules.job.service import JobService
from app.modules.users.dependencies import get_current_user
from app.modules.users.models import User
from app.modules.job.state_machine import (
    VALID_TRANSITIONS, ALLOWED_ACTIONS, STATUS_LABELS, JobStatus
)

router = APIRouter()


@router.get("/states")
async def get_job_states():
    """Trả về state machine: trạng thái, chuyển tiếp hợp lệ và actions cho frontend."""
    return {
        "states": [
            {
                "value": s.value,
                "label": STATUS_LABELS[s],
                "is_terminal": not bool(VALID_TRANSITIONS[s]),
                "transitions": [t.value for t in VALID_TRANSITIONS[s]],
                "actions": list(ALLOWED_ACTIONS[s]),
            }
            for s in JobStatus
        ]
    }


@router.get("")
async def list_job(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    query: Optional[str] = Query(None, description="Tìm theo mã job"),
    status: Optional[str] = Query(None, description="Lọc theo trạng thái"),
    job_type: Optional[str] = Query(None, description="Lọc theo loại job"),
    user_id: Optional[int] = Query(None, description="Lọc theo người tạo"),
    include_deleted: bool = Query(False, description="Bao gồm cả job đã xóa"),
    sort_by: str = Query("id", description="Sắp xếp theo cột"),
    sort_order: str = Query("asc", description="asc | desc"),
    db: AsyncSession = Depends(get_db),
):
    service = JobService(db)
    return await service.list(
        skip=skip, limit=limit, query=query, status=status,
        job_type=job_type, user_id=user_id, include_deleted=include_deleted,
        sort_by=sort_by, sort_order=sort_order,
    )


@router.get("/export/excel")
async def export_job_excel(
    query: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    service = JobService(db)
    try:
        excel_bytes = await service.export_excel(
            query=query, status=status, job_type=job_type,
            user_id=user_id, include_deleted=include_deleted,
        )
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
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    service = JobService(db)
    item = await service.get(id, include_deleted=include_deleted)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_job(data: dict, db: AsyncSession = Depends(get_db)):
    service = JobService(db)
    return await service.create(data)


@router.put("/{id}", response_model=dict)
async def update_job(id: int, data: dict, db: AsyncSession = Depends(get_db)):
    service = JobService(db)
    try:
        item = await service.update(id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(id: int, db: AsyncSession = Depends(get_db)):
    """Soft delete job (đặt deleted_at)."""
    service = JobService(db)
    success = await service.delete(id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return None


@router.patch("/{id}/restore", response_model=dict)
async def restore_job(id: int, db: AsyncSession = Depends(get_db)):
    """Khôi phục job đã soft-delete."""
    service = JobService(db)
    item = await service.restore(id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item


@router.delete("/{id}/hard", status_code=status.HTTP_204_NO_CONTENT)
async def hard_delete_job(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa vĩnh viễn job khỏi DB. Chỉ người tạo job mới có quyền thực hiện."""
    service = JobService(db)
    job = await service.get(id, include_deleted=True)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy job")
    if job.get("user_id") != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xóa vĩnh viễn job này. Chỉ người tạo job mới có thể thực hiện hành động này.",
        )
    await service.hard_delete(id)
    return None


@router.patch("/{id}/cancel", response_model=dict)
async def cancel_job(id: int, db: AsyncSession = Depends(get_db)):
    """Hủy job đang pending hoặc in_progress."""
    service = JobService(db)
    try:
        item = await service.cancel(id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item


@router.patch("/{id}/retry", response_model=dict)
async def retry_job(id: int, db: AsyncSession = Depends(get_db)):
    """Thử lại job failed hoặc cancelled."""
    service = JobService(db)
    try:
        item = await service.retry(id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item
