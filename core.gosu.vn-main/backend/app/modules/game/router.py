"""
Game Router - API endpoints

Author: GOSU Development Team
Version: 1.0.0
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.db.session import get_db
from app.modules.game.schemas import *
from app.modules.game.service import GameService

router = APIRouter()


@router.get("")
async def list_game(
    skip: Optional[int] = Query(None, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=100),
    page: Optional[int] = Query(None, ge=1),
    per_page: Optional[int] = Query(None, ge=1, le=100),
    is_active: Optional[bool] = Query(None),
    game_category_id: Optional[int] = Query(None, description="Lọc theo thể loại game"),
    search: Optional[str] = Query(None, description="Tìm theo tên game"),
    sort_by: str = Query("id", description="Sắp xếp theo cột"),
    sort_order: str = Query("desc", description="asc | desc"),
    db: AsyncSession = Depends(get_db),
):
    """List Game - Lấy danh sách có lọc thể loại, tìm kiếm và phân trang."""
    if page is not None and per_page is not None:
        skip = (page - 1) * per_page
        limit = per_page
    else:
        skip = skip if skip is not None else 0
        limit = limit if limit is not None else 20
    service = GameService(db)
    return await service.list(
        skip=skip,
        limit=limit,
        is_active=is_active,
        game_category_id=game_category_id,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/{id}", response_model=dict)
async def get_game(
    id: int,
    db: AsyncSession = Depends(get_db)
) -> GameResponse:
    """Get Game - Lấy chi tiết"""
    service = GameService(db)
    item = await service.get(id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item


@router.post("", response_model=GameResponse, status_code=status.HTTP_201_CREATED)
async def create_game(
    data: GameCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create Game - Tạo mới"""
    service = GameService(db)
    return await service.create(data.model_dump())


@router.put("/{id}", response_model=GameResponse)
async def update_game(
    id: int,
    data: GameUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update Game - Cập nhật"""
    service = GameService(db)
    item = await service.update(id, data.model_dump(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_game(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete Game - Xóa"""
    service = GameService(db)
    success = await service.delete(id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return None
