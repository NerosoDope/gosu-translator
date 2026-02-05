"""
Game_Glossary Service - Business logic

Author: GOSU Development Team
Version: 1.0.0
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.game_glossary.repository import Game_GlossaryRepository


class Game_GlossaryService:
    """Game_Glossary Service - Business logic cho game_glossary"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = Game_GlossaryRepository(db)
    
    async def list(self, skip: int = 0, limit: int = 20, search: Optional[str] = None, is_active: Optional[bool] = None, language_pair: Optional[str] = None, game_id: Optional[int] = None, sort_by: Optional[str] = None, sort_order: Optional[str] = None) -> List[Dict[str, Any]]:
        """List game_glossary"""
        return await self.repo.list(skip=skip, limit=limit, search=search, is_active=is_active, language_pair=language_pair, game_id=game_id, sort_by=sort_by, sort_order=sort_order)
    
    async def get(self, id: int) -> Optional[Dict[str, Any]]:
        """Get game_glossary by ID"""
        return await self.repo.get(id)
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create game_glossary"""
        return await self.repo.create(data)
    
    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update game_glossary"""
        return await self.repo.update(id, data)
    
    async def delete(self, id: int) -> bool:
        """Delete game_glossary"""
        return await self.repo.delete(id)
