from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from .repository import JobRepository

class JobService:
    def __init__(self, db: AsyncSession):
        self.repo = JobRepository(db)

    async def list(self, skip: int = 0, limit: int = 20):
        return await self.repo.list(skip=skip, limit=limit)

    async def get(self, id: int):
        return await self.repo.get(id)

    async def create(self, data: Dict[str, Any]):
        return await self.repo.create(data)

    async def update(self, id: int, data: Dict[str, Any]):
        return await self.repo.update(id, data)

    async def delete(self, id: int):
        return await self.repo.delete(id)
