"""
Job Service - Business logic

Author: GOSU Development Team
Version: 1.0.0
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.job.repository import JobRepository


class JobService:
    """Job Service - Business logic cho job"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = JobRepository(db)
    
    async def list(self, skip: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
        """List job"""
        return await self.repo.list(skip=skip, limit=limit)
    
    async def get(self, id: int) -> Optional[Dict[str, Any]]:
        """Get job by ID"""
        return await self.repo.get(id)
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create job"""
        return await self.repo.create(data)
    
    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update job"""
        return await self.repo.update(id, data)
    
    async def delete(self, id: int) -> bool:
        """Delete job"""
        return await self.repo.delete(id)
