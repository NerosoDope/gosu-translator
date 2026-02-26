"""Import Batches Repository - Data access layer"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.modules.import_batches.models import ImportBatch


class ImportBatchRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> ImportBatch:
        """Create import batch and return the model (need id for glossary items)"""
        batch = ImportBatch(**data)
        self.db.add(batch)
        await self.db.flush()  # Get id without commit
        await self.db.refresh(batch)
        return batch

    async def list(
        self,
        skip: int = 0,
        limit: int = 50,
        source_type: Optional[str] = None,
        game_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """List import batches"""
        query = select(ImportBatch).order_by(ImportBatch.created_at.desc())
        if source_type:
            query = query.where(ImportBatch.source_type == source_type)
        if game_id is not None:
            query = query.where(ImportBatch.game_id == game_id)
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        items = result.scalars().all()
        return [item.to_dict() for item in items]

    async def get(self, id: int) -> Optional[Dict[str, Any]]:
        """Get import batch by ID"""
        result = await self.db.execute(select(ImportBatch).where(ImportBatch.id == id))
        item = result.scalar_one_or_none()
        return item.to_dict() if item else None

    async def delete(self, id: int) -> bool:
        """Delete import batch record (glossary items will have import_id SET NULL)"""
        result = await self.db.execute(select(ImportBatch).where(ImportBatch.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True
