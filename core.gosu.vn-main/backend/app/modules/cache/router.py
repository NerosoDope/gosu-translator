from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from .service import CacheService
from .schemas import CacheCreate, CacheUpdate, CacheResponse
from typing import List

router = APIRouter(tags=["Cache"])

@router.get("/", response_model=List[CacheResponse])
async def list_cache(skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100), db: AsyncSession = Depends(get_db)):
    service = CacheService(db)
    caches = await service.list(skip=skip, limit=limit)
    return caches

@router.get("/{id}", response_model=CacheResponse)
async def get_cache(id: int, db: AsyncSession = Depends(get_db)):
    service = CacheService(db)
    cache = await service.get(id)
    if not cache:
        raise HTTPException(status_code=404, detail="Cache not found")
    return cache

@router.post("/", response_model=CacheResponse)
async def create_cache(data: CacheCreate, db: AsyncSession = Depends(get_db)):
    service = CacheService(db)
    return await service.create(data.model_dump())

@router.put("/{id}", response_model=CacheResponse)
async def update_cache(id: int, data: CacheUpdate, db: AsyncSession = Depends(get_db)):
    service = CacheService(db)
    cache = await service.update(id, data.model_dump(exclude_unset=True))
    if not cache:
        raise HTTPException(status_code=404, detail="Cache not found")
    return cache

@router.delete("/{id}", response_model=bool)
async def delete_cache(id: int, db: AsyncSession = Depends(get_db)):
    service = CacheService(db)
    result = await service.delete(id)
    if not result:
        raise HTTPException(status_code=404, detail="Cache not found")
    return result
