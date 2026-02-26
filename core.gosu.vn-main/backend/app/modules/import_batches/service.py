"""Import Batches Service - Business logic"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from app.modules.import_batches.repository import ImportBatchRepository


class ImportBatchService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ImportBatchRepository(db)

    async def create(
        self,
        source_type: str,
        filename: str,
        total_rows: int,
        created_count: int,
        error_count: int,
        game_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> int:
        """Create import batch, return batch id"""
        batch = await self.repo.create({
            "source_type": source_type,
            "game_id": game_id,
            "filename": filename,
            "total_rows": total_rows,
            "created_count": created_count,
            "error_count": error_count,
            "user_id": user_id,
        })
        await self.db.commit()
        return batch.id

    async def list(
        self,
        skip: int = 0,
        limit: int = 50,
        source_type: Optional[str] = None,
        game_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        return await self.repo.list(skip=skip, limit=limit, source_type=source_type, game_id=game_id)

    async def get(self, id: int) -> Optional[Dict[str, Any]]:
        return await self.repo.get(id)

    async def rollback(self, batch_id: int) -> Dict[str, Any]:
        """
        Xoá toàn bộ bản ghi có import_id = batch_id.
        Trả về số bản ghi đã xoá.
        """
        batch = await self.repo.get(batch_id)
        if not batch:
            return {"success": False, "batch_id": batch_id, "deleted_count": 0, "message": "Batch not found"}

        source_type = batch["source_type"]
        deleted_count = 0

        # Lazy import để tránh circular import với global_glossary.service / game_glossary.service
        if source_type == "global_glossary":
            from app.modules.global_glossary.models import Global_Glossary
            result = await self.db.execute(
                delete(Global_Glossary).where(Global_Glossary.import_id == batch_id)
            )
            deleted_count = result.rowcount
        elif source_type == "game_glossary":
            from app.modules.game_glossary.models import Game_Glossary
            result = await self.db.execute(
                delete(Game_Glossary).where(Game_Glossary.import_id == batch_id)
            )
            deleted_count = result.rowcount
        else:
            return {"success": False, "batch_id": batch_id, "deleted_count": 0, "message": f"Unknown source_type: {source_type}"}

        await self.repo.delete(batch_id)
        return {
            "success": True,
            "batch_id": batch_id,
            "deleted_count": deleted_count,
            "message": f"Đã xoá {deleted_count} bản ghi từ lần import {batch_id}",
        }
