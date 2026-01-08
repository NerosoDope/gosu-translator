from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from .service import DictionaryService
from .schemas import DictionaryCreate, DictionaryUpdate, DictionaryResponse
from typing import List

router = APIRouter(prefix="/dictionary", tags=["Dictionary"])

@router.get("/", response_model=List[DictionaryResponse])
async def list_dictionary(skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100), db: AsyncSession = Depends(get_db)):
    service = DictionaryService(db)
    items = await service.list(skip=skip, limit=limit)
    return items

@router.get("/{id}", response_model=DictionaryResponse)
async def get_dictionary(id: int, db: AsyncSession = Depends(get_db)):
    service = DictionaryService(db)
    item = await service.get(id)
    if not item:
        raise HTTPException(status_code=404, detail="Dictionary entry not found")
    return item

@router.post("/", response_model=DictionaryResponse)
async def create_dictionary(data: DictionaryCreate, db: AsyncSession = Depends(get_db)):
    service = DictionaryService(db)
    return await service.create(data.dict())

@router.put("/{id}", response_model=DictionaryResponse)
async def update_dictionary(id: int, data: DictionaryUpdate, db: AsyncSession = Depends(get_db)):
    service = DictionaryService(db)
    item = await service.update(id, data.dict(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=404, detail="Dictionary entry not found")
    return item

@router.delete("/{id}", response_model=bool)
async def delete_dictionary(id: int, db: AsyncSession = Depends(get_db)):
    service = DictionaryService(db)
    result = await service.delete(id)
    if not result:
        raise HTTPException(status_code=404, detail="Dictionary entry not found")
    return result
