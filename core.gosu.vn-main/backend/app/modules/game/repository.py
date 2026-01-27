"""
Game Repository - Data access layer

Author: GOSU Development Team
Version: 1.0.0
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.game.models import Game


class GameRepository:
    """Game Repository - Data access cho game"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def list(self, skip: int = 0, limit: int = 20, is_active: Optional[bool] = None) -> List[Dict[str, Any]]:
        """List game"""
        query = select(Game)
        if is_active is not None:
            query = query.where(Game.is_active == is_active)
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        items = result.scalars().all()
        return [item.to_dict() for item in items]
    
    async def get(self, id: int) -> Optional[Dict[str, Any]]:
        """Get game by ID"""
        result = await self.db.execute(select(Game).where(Game.id == id))
        item = result.scalar_one_or_none()
        return item.to_dict() if item else None
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create game"""
        item = Game(**data)
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item.to_dict()
    
    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update game"""
        result = await self.db.execute(select(Game).where(Game.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return None
        for key, value in data.items():
            setattr(item, key, value)
        await self.db.commit()
        await self.db.refresh(item)
        return item.to_dict()
    
    async def delete(self, id: int) -> bool:
        """Delete game"""
        result = await self.db.execute(select(Game).where(Game.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True
