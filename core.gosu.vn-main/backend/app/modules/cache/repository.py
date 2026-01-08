from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import Cache

class CacheRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, skip: int = 0, limit: int = 20) -> List[Cache]:
        query = select(Cache).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get(self, id: int) -> Optional[Cache]:
        result = await self.db.execute(select(Cache).where(Cache.id == id))
        return result.scalar_one_or_none()

    async def create(self, data: Dict[str, Any]) -> Cache:
        cache = Cache(**data)
        self.db.add(cache)
        await self.db.commit()
        await self.db.refresh(cache)
        return cache

    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Cache]:
        result = await self.db.execute(select(Cache).where(Cache.id == id))
        cache = result.scalar_one_or_none()
        if not cache:
            return None
        for key, value in data.items():
            setattr(cache, key, value)
        await self.db.commit()
        await self.db.refresh(cache)
        return cache

    async def delete(self, id: int) -> bool:
        result = await self.db.execute(select(Cache).where(Cache.id == id))
        cache = result.scalar_one_or_none()
        if not cache:
            return False
        await self.db.delete(cache)
        await self.db.commit()
        return True
