from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from .models import GameCategory

class GameCategoryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, skip: int = 0, limit: int = 20) -> List[GameCategory]:
        query = select(GameCategory).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def count(self) -> int:
        query = select(func.count()).select_from(GameCategory)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get(self, id: int) -> Optional[GameCategory]:
        result = await self.db.execute(select(GameCategory).where(GameCategory.id == id))
        return result.scalar_one_or_none()

    async def create(self, data: Dict[str, Any]) -> GameCategory:
        item = GameCategory(**data)
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def update(self, id: int, data: Dict[str, Any]) -> Optional[GameCategory]:
        result = await self.db.execute(select(GameCategory).where(GameCategory.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return None
        for key, value in data.items():
            setattr(item, key, value)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def delete(self, id: int) -> bool:
        result = await self.db.execute(select(GameCategory).where(GameCategory.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True
