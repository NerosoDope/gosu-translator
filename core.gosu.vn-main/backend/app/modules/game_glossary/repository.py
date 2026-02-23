"""
Game_Glossary Repository - Data access layer

Author: GOSU Development Team
Version: 1.0.0
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.modules.game_glossary.models import Game_Glossary


class Game_GlossaryRepository:
    """Game_Glossary Repository - Data access cho game_glossary"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def list(self, skip: int = 0, limit: int = 20, search: Optional[str] = None, is_active: Optional[bool] = None, language_pair: Optional[str] = None, game_id: Optional[int] = None, sort_by: Optional[str] = None, sort_order: Optional[str] = None) -> List[Dict[str, Any]]:
        """List game_glossary"""
        query = select(Game_Glossary)

        if search:
            query = query.where(Game_Glossary.term.ilike(f'%{search}%') | Game_Glossary.translated_term.ilike(f'%{search}%'))
        if is_active is not None:
            query = query.where(Game_Glossary.is_active == is_active)
        if language_pair:
            query = query.where(Game_Glossary.language_pair == language_pair)
        if game_id:
            query = query.where(Game_Glossary.game_id == game_id)
        
        # Sorting
        if sort_by:
            sort_column = getattr(Game_Glossary, sort_by, None)
            if sort_column:
                if sort_order == "desc":
                    query = query.order_by(sort_column.desc())
                else:
                    query = query.order_by(sort_column.asc())

        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        items = result.scalars().all()
        return [item.to_dict() for item in items]
    
    async def get(self, id: int) -> Optional[Dict[str, Any]]:
        """Get game_glossary by ID"""
        # TODO: Implement when model is created
        result = await self.db.execute(select(Game_Glossary).where(Game_Glossary.id == id))
        item = result.scalar_one_or_none()
        return item.to_dict() if item else None
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create game_glossary"""
        # TODO: Implement when model is created
        item = Game_Glossary(**data)
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item.to_dict()
    
    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update game_glossary"""
        # TODO: Implement when model is created
        result = await self.db.execute(select(Game_Glossary).where(Game_Glossary.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return None
        for key, value in data.items():
            setattr(item, key, value)
        await self.db.commit()
        await self.db.refresh(item)
        return item.to_dict()
    
    async def delete(self, id: int) -> bool:
        """Delete game_glossary"""
        result = await self.db.execute(select(Game_Glossary).where(Game_Glossary.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True

    async def delete_all(self, game_id: Optional[int] = None) -> int:
        """Delete all game_glossary, optionally filter by game_id. Return count deleted."""
        query = delete(Game_Glossary)
        if game_id is not None:
            query = query.where(Game_Glossary.game_id == game_id)
        result = await self.db.execute(query)
        await self.db.commit()
        return result.rowcount

    async def get_existing_keys(self, game_ids: Optional[List[int]] = None) -> set:
        """Trả về set các (term, translated_term, language_pair, game_id) đã tồn tại."""
        query = select(
            Game_Glossary.term, Game_Glossary.translated_term,
            Game_Glossary.language_pair, Game_Glossary.game_id
        )
        if game_ids:
            query = query.where(Game_Glossary.game_id.in_(game_ids))
        result = await self.db.execute(query)
        rows = result.all()
        return {(r.term, r.translated_term, r.language_pair, r.game_id) for r in rows}

    async def bulk_create(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Bulk create game_glossary items"""
        created_items = []
        for data in items:
            item = Game_Glossary(**data)
            self.db.add(item)
            created_items.append(item)
        await self.db.commit()
        for item in created_items:
            await self.db.refresh(item)
        return [item.to_dict() for item in created_items]