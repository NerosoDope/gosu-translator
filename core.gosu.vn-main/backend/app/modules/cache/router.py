import io
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from .service import CacheService
from .schemas import CacheCreate, CacheUpdate, CacheResponse
from typing import List, Optional

router = APIRouter(tags=["Cache"])

@router.get("")
@router.get("/")
async def list_cache(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    query: Optional[str] = Query(None, description="Tìm theo key"),
    sort_by: str = Query("id", description="Sắp xếp theo cột"),
    sort_order: str = Query("asc", description="asc | desc"),
    db: AsyncSession = Depends(get_db),
):
    """List cache với phân trang, tìm kiếm, sắp xếp. Trả về { items, total, page, per_page, pages }."""
    service = CacheService(db)
    return await service.list(
        skip=skip, limit=limit, query=query, sort_by=sort_by, sort_order=sort_order
    )


@router.get("/export/excel")
async def export_cache_excel(
    query: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Export danh sách cache ra file Excel."""
    service = CacheService(db)
    try:
        excel_bytes = await service.export_excel(query=query)
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="openpyxl module is not installed on the server.",
        )
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="cache_export.xlsx"'},
    )

@router.post("", response_model=CacheResponse)
@router.post("/", response_model=CacheResponse)
async def create_cache(data: CacheCreate, db: AsyncSession = Depends(get_db)):
    service = CacheService(db)
    return await service.create(data.model_dump())

@router.get("/{id}", response_model=CacheResponse)
@router.get("/{id}/", response_model=CacheResponse)
async def get_cache(id: int, db: AsyncSession = Depends(get_db)):
    service = CacheService(db)
    cache = await service.get(id)
    if not cache:
        raise HTTPException(status_code=404, detail="Cache not found")
    return cache

@router.put("/{id}", response_model=CacheResponse)
@router.put("/{id}/", response_model=CacheResponse)
async def update_cache(id: int, data: CacheUpdate, db: AsyncSession = Depends(get_db)):
    service = CacheService(db)
    cache = await service.update(id, data.model_dump(exclude_unset=True))
    if not cache:
        raise HTTPException(status_code=404, detail="Cache not found")
    return cache

@router.delete("/{id}", response_model=bool)
@router.delete("/{id}/", response_model=bool)
async def delete_cache(id: int, db: AsyncSession = Depends(get_db)):
    service = CacheService(db)
    result = await service.delete(id)
    if not result:
        raise HTTPException(status_code=404, detail="Cache not found")
    return result
