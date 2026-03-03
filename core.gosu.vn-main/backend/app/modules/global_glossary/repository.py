"""
Global_Glossary Repository - Data access layer

Author: GOSU Development Team
Version: 1.0.0
"""

from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from app.modules.global_glossary.models import Global_Glossary
from app.modules.import_batches.models import ImportBatch


class Global_GlossaryRepository:
    """Global_Glossary Repository - Data access cho global_glossary"""
    
    def __init__(self, db: AsyncSession):
        self.db = db

    def _row_to_dict(self, row) -> Dict[str, Any]:
        """Chuyển row (Global_Glossary, imported_at) thành dict dùng thông tin từ import_batches."""
        gg, imported_at = row[0], row[1] if len(row) > 1 else None
        d = gg.to_dict()
        d["imported_at"] = imported_at
        return d

    def _apply_filters(self, q, count_q, search: Optional[str], is_active: Optional[bool], language_pair: Optional[str], game_category_id: Optional[int]):
        """Áp dụng bộ lọc tìm kiếm và lọc cho query và count query."""
        if search and search.strip():
            term = f"%{search.strip()}%"
            cond = Global_Glossary.term.ilike(term) | Global_Glossary.translated_term.ilike(term)
            q = q.where(cond)
            count_q = count_q.where(cond)
        if is_active is not None:
            q = q.where(Global_Glossary.is_active == is_active)
            count_q = count_q.where(Global_Glossary.is_active == is_active)
        if language_pair and language_pair.strip():
            q = q.where(Global_Glossary.language_pair == language_pair.strip())
            count_q = count_q.where(Global_Glossary.language_pair == language_pair.strip())
        if game_category_id is not None:
            q = q.where(Global_Glossary.game_category_id == game_category_id)
            count_q = count_q.where(Global_Glossary.game_category_id == game_category_id)
        return q, count_q
    
    async def list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        language_pair: Optional[str] = None,
        game_category_id: Optional[int] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """List global_glossary với tìm kiếm, lọc, sắp xếp. Join import_batches để lấy imported_at. Trả về (items, total)."""
        query = (
            select(Global_Glossary, ImportBatch.created_at.label("imported_at"))
            .select_from(Global_Glossary)
            .outerjoin(ImportBatch, Global_Glossary.import_id == ImportBatch.id)
        )
        count_q = select(func.count()).select_from(Global_Glossary)
        query, count_q = self._apply_filters(query, count_q, search, is_active, language_pair, game_category_id)

        if sort_by:
            sort_column = getattr(Global_Glossary, sort_by, None)
            if sort_column is not None:
                if sort_order == "desc":
                    query = query.order_by(sort_column.desc())
                else:
                    query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(Global_Glossary.id.desc())

        total = (await self.db.execute(count_q)).scalar() or 0
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        rows = result.all()
        return [self._row_to_dict(row) for row in rows], total
    
    async def find_translation(
        self, term: str, language_pair: str, game_category_id: Optional[int] = None
    ) -> Optional[str]:
        """Tìm bản dịch theo term và language_pair (exact match), trả về translated_term hoặc None.
        Nếu game_category_id được chỉ định, chỉ tra trong từ điển chung của thể loại đó.
        """
        if not (term or "").strip() or not (language_pair or "").strip():
            return None
        conditions = [
            Global_Glossary.term == term.strip(),
            Global_Glossary.language_pair == language_pair.strip(),
            Global_Glossary.is_active == True,
        ]
        if game_category_id is not None:
            conditions.append(Global_Glossary.game_category_id == game_category_id)
        result = await self.db.execute(
            select(Global_Glossary.translated_term).where(*conditions).limit(1)
        )
        row = result.one_or_none()
        return row[0] if row else None

    async def get(self, id: int) -> Optional[Dict[str, Any]]:
        """Get global_glossary by ID, kèm imported_at từ import_batches."""
        result = await self.db.execute(
            select(Global_Glossary, ImportBatch.created_at.label("imported_at"))
            .select_from(Global_Glossary)
            .outerjoin(ImportBatch, Global_Glossary.import_id == ImportBatch.id)
            .where(Global_Glossary.id == id)
        )
        row = result.one_or_none()
        if not row:
            return None
        return self._row_to_dict(row)
    
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