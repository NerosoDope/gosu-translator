"""
Game Repository - Data access layer

Author: GOSU Development Team
Version: 1.0.0
"""

from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.modules.game.models import Game


class GameRepository:
    """Game Repository - Data access cho game"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def list(
        self,
        skip: int = 0,
        limit: int = 20,
        is_active: Optional[bool] = None,
        game_category_id: Optional[int] = None,
        search: Optional[str] = None,
        sort_by: str = "id",
        sort_order: str = "desc",
    ) -> Tuple[List[Dict[str, Any]], int]:
        """List game với lọc và phân trang. Trả về (items, total)."""
        q = select(Game)
        if is_active is not None:
            q = q.where(Game.is_active == is_active)
        if game_category_id is not None:
            q = q.where(Game.game_category_id == game_category_id)
        if search and search.strip():
            q = q.where(Game.name.ilike(f"%{search.strip()}%"))
        order_col = getattr(Game, sort_by, Game.id)
        q = q.order_by(order_col.desc() if sort_order == "desc" else order_col.asc())
        # Count với cùng bộ lọc
        count_q = select(func.count()).select_from(Game)
        if is_active is not None:
            count_q = count_q.where(Game.is_active == is_active)
        if game_category_id is not None:
            count_q = count_q.where(Game.game_category_id == game_category_id)
        if search and search.strip():
            count_q = count_q.where(Game.name.ilike(f"%{search.strip()}%"))
        total = (await self.db.execute(count_q)).scalar() or 0
        result = await self.db.execute(q.offset(skip).limit(limit))
        items = result.scalars().all()
        return [item.to_dict() for item in items], total
    
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
