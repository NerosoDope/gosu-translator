"""
Game_Glossary Router - API endpoints

Author: GOSU Development Team
Version: 1.0.0
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.db.session import get_db
from app.modules.game_glossary.schemas import Game_GlossaryResponse, Game_GlossaryCreate, Game_GlossaryUpdate
from app.modules.game_glossary.service import Game_GlossaryService

router = APIRouter()


@router.get("", response_model=List[Game_GlossaryResponse])
async def list_game_glossary(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    language_pair: Optional[str] = Query(None),
    game_id: Optional[int] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """List Game_Glossary - Lấy danh sách"""
    service = Game_GlossaryService(db)
    return await service.list(skip=skip, limit=limit, search=search, is_active=is_active, language_pair=language_pair, game_id=game_id, sort_by=sort_by, sort_order=sort_order)


@router.get("/{id}", response_model=Game_GlossaryResponse)
async def get_game_glossary(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get Game_Glossary - Lấy chi tiết"""
    service = Game_GlossaryService(db)
    item = await service.get(id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item


@router.post("", response_model=Game_GlossaryResponse, status_code=status.HTTP_201_CREATED)
async def create_game_glossary(
    data: Game_GlossaryCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create Game_Glossary - Tạo mới"""
    service = Game_GlossaryService(db)
    return await service.create(data.model_dump())


@router.put("/{id}", response_model=Game_GlossaryResponse)
async def update_game_glossary(
    id: int,
    data: Game_GlossaryUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update Game_Glossary - Cập nhật"""
    service = Game_GlossaryService(db)
    item = await service.update(id, data.model_dump(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_game_glossary(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete Game_Glossary - Xóa"""
    service = Game_GlossaryService(db)
    success = await service.delete(id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return None
