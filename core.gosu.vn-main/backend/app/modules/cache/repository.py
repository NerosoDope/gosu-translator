from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from .models import Cache

class CacheRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(
        self,
        skip: int = 0,
        limit: int = 20,
        query_str: Optional[str] = None,
        sort_by: str = "id",
        sort_order: str = "asc",
    ) -> Tuple[List[Cache], int]:
        """List cache with optional search on key. Returns (items, total)."""
        q = select(Cache)
        if query_str and query_str.strip():
            term = f"%{query_str.strip()}%"
            q = q.where(Cache.key.ilike(term))
        order_col = getattr(Cache, sort_by, Cache.id)
        q = q.order_by(order_col.desc() if sort_order == "desc" else order_col.asc())
        count_q = select(func.count()).select_from(Cache)
        if query_str and query_str.strip():
            count_q = count_q.where(Cache.key.ilike(term))
        total = (await self.db.execute(count_q)).scalar() or 0
        result = await self.db.execute(q.offset(skip).limit(limit))
        return result.scalars().all(), total

    async def list_all(
        self,
        query_str: Optional[str] = None,
        sort_by: str = "id",
        sort_order: str = "asc",
        limit: int = 100000,
    ) -> List[Cache]:
        """List all cache for export."""
        q = select(Cache)
        if query_str and query_str.strip():
            q = q.where(Cache.key.ilike(f"%{query_str.strip()}%"))
        order_col = getattr(Cache, sort_by, Cache.id)
        q = q.order_by(order_col.desc() if sort_order == "desc" else order_col.asc())
        result = await self.db.execute(q.limit(limit))
        return result.scalars().all()

    async def get(self, id: int) -> Optional[Cache]:
        result = await self.db.execute(select(Cache).where(Cache.id == id))
        return result.scalar_one_or_none()

    async def get_by_key(self, key: str) -> Optional[Cache]:
        result = await self.db.execute(select(Cache).where(Cache.key == key))
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
