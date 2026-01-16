"""
Job Repository - Data access layer

Author: GOSU Development Team
Version: 1.0.0
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from app.modules.job.models import Job


class JobRepository:
    """Job Repository - Data access cho job"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def list(self, skip: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
        """List job"""
        query = select(Job).offset(skip).limit(limit)
        result = await self.db.execute(query)
        items = result.scalars().all()
        return [item.to_dict() for item in items]
    
    async def get(self, id: int) -> Optional[Dict[str, Any]]:
        """Get job by ID"""
        result = await self.db.execute(select(Job).where(Job.id == id))
        item = result.scalar_one_or_none()
        return item.to_dict() if item else None
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create job"""
        item = Job(**data)
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item.to_dict()
    
    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update job"""
        result = await self.db.execute(select(Job).where(Job.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return None
        for key, value in data.items():
            setattr(item, key, value)
        await self.db.commit()
        await self.db.refresh(item)
        return item.to_dict()
    
    async def delete(self, id: int) -> bool:
        """Delete job"""
        result = await self.db.execute(select(Job).where(Job.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True
