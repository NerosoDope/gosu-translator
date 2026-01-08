from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import Prompt

class PromptsRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, skip: int = 0, limit: int = 20) -> List[Prompt]:
        query = select(Prompt).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get(self, id: int) -> Optional[Prompt]:
        result = await self.db.execute(select(Prompt).where(Prompt.id == id))
        return result.scalar_one_or_none()

    async def create(self, data: Dict[str, Any]) -> Prompt:
        item = Prompt(**data)
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Prompt]:
        result = await self.db.execute(select(Prompt).where(Prompt.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return None
        for key, value in data.items():
            setattr(item, key, value)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def delete(self, id: int) -> bool:
        result = await self.db.execute(select(Prompt).where(Prompt.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True
