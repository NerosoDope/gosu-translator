"""Import Batches Router - API endpoints"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.db.session import get_db
from app.modules.import_batches.service import ImportBatchService
from app.modules.import_batches.schemas import ImportBatchResponse, ImportBatchRollbackResponse

router = APIRouter()


@router.get("", response_model=List[ImportBatchResponse])
async def list_import_batches(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    source_type: Optional[str] = Query(None, description="global_glossary | game_glossary"),
    game_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Danh sách lịch sử import"""
    service = ImportBatchService(db)
    return await service.list(skip=skip, limit=limit, source_type=source_type, game_id=game_id)


@router.get("/{batch_id}", response_model=ImportBatchResponse)
async def get_import_batch(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Chi tiết một lần import"""
    service = ImportBatchService(db)
    item = await service.get(batch_id)
    if not item:
        raise HTTPException(status_code=404, detail="Import batch not found")
    return item


@router.post("/{batch_id}/rollback", response_model=ImportBatchRollbackResponse)
async def rollback_import(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Rollback lần import: xoá toàn bộ bản ghi (từ điển) vừa import vào.
    Dùng khi import sai và muốn hoàn tác.
    """
    service = ImportBatchService(db)
    result = await service.rollback(batch_id)
    return ImportBatchRollbackResponse(**result)
