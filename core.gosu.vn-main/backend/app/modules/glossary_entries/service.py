"""
Glossary_Entries Service - Business logic

Author: GOSU Development Team
Version: 1.0.0
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.glossary_entries.repository import Glossary_EntriesRepository


class Glossary_EntriesService:
    """Glossary_Entries Service - Business logic cho glossary_entries"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = Glossary_EntriesRepository(db)
    
    async def list(self, skip: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
        """List glossary_entries"""
        return await self.repo.list(skip=skip, limit=limit)
    
    async def get(self, id: int) -> Optional[Dict[str, Any]]:
        """Get glossary_entries by ID"""
        return await self.repo.get(id)
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create glossary_entries"""
        return await self.repo.create(data)
    
    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update glossary_entries"""
        return await self.repo.update(id, data)
    
    async def delete(self, id: int) -> bool:
        """Delete glossary_entries"""
        return await self.repo.delete(id)
