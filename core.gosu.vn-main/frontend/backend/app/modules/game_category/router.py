from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from .service import GameCategoryService
from .schemas import GameCategoryCreate, GameCategoryUpdate, GameCategoryResponse
from typing import List

router = APIRouter(prefix="/game-category", tags=["GameCategory"])

@router.get("/", response_model=List[GameCategoryResponse])
async def list_game_categories(skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100), db: AsyncSession = Depends(get_db)):
    service = GameCategoryService(db)
    items = await service.list(skip=skip, limit=limit)
    return items

@router.get("/{id}", response_model=GameCategoryResponse)
async def get_game_category(id: int, db: AsyncSession = Depends(get_db)):
    service = GameCategoryService(db)
    item = await service.get(id)
    if not item:
        raise HTTPException(status_code=404, detail="Game category not found")
    return item

@router.post("/", response_model=GameCategoryResponse)
async def create_game_category(data: GameCategoryCreate, db: AsyncSession = Depends(get_db)):
    service = GameCategoryService(db)
    return await service.create(data.dict())

@router.put("/{id}", response_model=GameCategoryResponse)
async def update_game_category(id: int, data: GameCategoryUpdate, db: AsyncSession = Depends(get_db)):
    service = GameCategoryService(db)
    item = await service.update(id, data.dict(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=404, detail="Game category not found")
    return item

@router.delete("/{id}", response_model=bool)
async def delete_game_category(id: int, db: AsyncSession = Depends(get_db)):
    service = GameCategoryService(db)
    result = await service.delete(id)
    if not result:
        raise HTTPException(status_code=404, detail="Game category not found")
    return result
