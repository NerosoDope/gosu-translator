from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from .repository import GameCategoryRepository

class GameCategoryService:
    def __init__(self, db: AsyncSession):
        self.repo = GameCategoryRepository(db)

    async def list(self, skip: int = 0, limit: int = 20):
        items = await self.repo.list(skip=skip, limit=limit)
        total = await self.repo.count()
        return {
            "items": items,
            "total": total,
            "page": (skip // limit) + 1,
            "per_page": limit,
            "pages": (total + limit - 1) // limit if limit > 0 else 0
        }

    async def get(self, id: int):
        return await self.repo.get(id)

    async def create(self, data: Dict[str, Any]):
        return await self.repo.create(data)

    async def update(self, id: int, data: Dict[str, Any]):
        return await self.repo.update(id, data)

    async def delete(self, id: int):
        return await self.repo.delete(id)
