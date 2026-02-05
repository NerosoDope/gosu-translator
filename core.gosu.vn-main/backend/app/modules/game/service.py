"""
Game Service - Business logic

Author: GOSU Development Team
Version: 1.0.0
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.game.repository import GameRepository


class GameService:
    """Game Service - Business logic cho game"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = GameRepository(db)
    
    async def list(self, skip: int = 0, limit: int = 20, is_active: Optional[bool] = None) -> List[Dict[str, Any]]:
        """List game"""
        return await self.repo.list(skip=skip, limit=limit, is_active=is_active)
    
    async def get(self, id: int) -> Optional[Dict[str, Any]]:
        """Get game by ID"""
        return await self.repo.get(id)
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create game"""
        return await self.repo.create(data)
    
    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update game"""
        return await self.repo.update(id, data)
    
    async def delete(self, id: int) -> bool:
        """Delete game"""
        return await self.repo.delete(id)
