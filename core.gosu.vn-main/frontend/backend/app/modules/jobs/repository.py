from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import Job

class JobRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, skip: int = 0, limit: int = 20) -> List[Job]:
        query = select(Job).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get(self, id: int) -> Optional[Job]:
        result = await self.db.execute(select(Job).where(Job.id == id))
        return result.scalar_one_or_none()

    async def create(self, data: Dict[str, Any]) -> Job:
        job = Job(**data)
        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Job]:
        result = await self.db.execute(select(Job).where(Job.id == id))
        job = result.scalar_one_or_none()
        if not job:
            return None
        for key, value in data.items():
            setattr(job, key, value)
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def delete(self, id: int) -> bool:
        result = await self.db.execute(select(Job).where(Job.id == id))
        job = result.scalar_one_or_none()
        if not job:
            return False
        await self.db.delete(job)
        await self.db.commit()
        return True
