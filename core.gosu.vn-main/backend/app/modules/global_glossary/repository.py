"""
Global_Glossary Repository - Data access layer

Author: GOSU Development Team
Version: 1.0.0
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.modules.global_glossary.models import Global_Glossary


class Global_GlossaryRepository:
    """Global_Glossary Repository - Data access cho global_glossary"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def list(self, skip: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
        """List global_glossary"""
        query = select(Global_Glossary).offset(skip).limit(limit)
        result = await self.db.execute(query)
        items = result.scalars().all()
        return [item.to_dict() for item in items]
    
    async def get(self, id: int) -> Optional[Dict[str, Any]]:
        """Get global_glossary by ID"""
        result = await self.db.execute(select(Global_Glossary).where(Global_Glossary.id == id))
        item = result.scalar_one_or_none()
        return item.to_dict() if item else None
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create global_glossary"""
        item = Global_Glossary(**data)
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item.to_dict()
    
    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update global_glossary"""
        result = await self.db.execute(select(Global_Glossary).where(Global_Glossary.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return None
        for key, value in data.items():
            setattr(item, key, value)
        await self.db.commit()
        await self.db.refresh(item)
        return item.to_dict()
    
    async def delete(self, id: int) -> bool:
        """Delete global_glossary"""
        result = await self.db.execute(select(Global_Glossary).where(Global_Glossary.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True

    async def delete_all(self) -> int:
        """Delete all global_glossary, return count deleted"""
        result = await self.db.execute(delete(Global_Glossary))
        await self.db.commit()
        return result.rowcount

    async def get_existing_keys(self) -> set:
        """Trả về set các (term, translated_term, language_pair, game_category_id) đã tồn tại."""
        result = await self.db.execute(
            select(Global_Glossary.term, Global_Glossary.translated_term, Global_Glossary.language_pair, Global_Glossary.game_category_id)
        )
        rows = result.all()
        return {(r.term, r.translated_term, r.language_pair, r.game_category_id) for r in rows}

    async def bulk_create(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Bulk create global_glossary items"""
        created_items = []
        for data in items:
            item = Global_Glossary(**data)
            self.db.add(item)
            created_items.append(item)
        await self.db.commit()
        for item in created_items:
            await self.db.refresh(item)
        return [item.to_dict() for item in created_items]