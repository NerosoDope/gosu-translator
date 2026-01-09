from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from .service import GameGlossaryService
from .schemas import GameGlossaryCreate, GameGlossaryUpdate, GameGlossaryResponse
from typing import List

router = APIRouter(tags=["GameGlossary"])

@router.get("/", response_model=List[GameGlossaryResponse])
async def list_game_glossary(skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100), db: AsyncSession = Depends(get_db)):
    service = GameGlossaryService(db)
    items = await service.list(skip=skip, limit=limit)
    return items

@router.get("/{id}", response_model=GameGlossaryResponse)
async def get_game_glossary(id: int, db: AsyncSession = Depends(get_db)):
    service = GameGlossaryService(db)
    item = await service.get(id)
    if not item:
        raise HTTPException(status_code=404, detail="Game glossary item not found")
    return item

@router.post("/", response_model=GameGlossaryResponse)
async def create_game_glossary(data: GameGlossaryCreate, db: AsyncSession = Depends(get_db)):
    service = GameGlossaryService(db)
    return await service.create(data.dict())

@router.put("/{id}", response_model=GameGlossaryResponse)
async def update_game_glossary(id: int, data: GameGlossaryUpdate, db: AsyncSession = Depends(get_db)):
    service = GameGlossaryService(db)
    item = await service.update(id, data.dict(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=404, detail="Game glossary item not found")
    return item

@router.delete("/{id}", response_model=bool)
async def delete_game_glossary(id: int, db: AsyncSession = Depends(get_db)):
    service = GameGlossaryService(db)
    result = await service.delete(id)
    if not result:
        raise HTTPException(status_code=404, detail="Game glossary item not found")
    return result
