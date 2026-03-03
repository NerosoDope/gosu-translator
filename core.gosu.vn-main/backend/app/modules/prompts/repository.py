from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, update
from .models import Prompt

class PromptsRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def count(
        self,
        query: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> int:
        stmt = select(func.count()).select_from(Prompt)
        if query:
            q = f"%{query}%"
            stmt = stmt.where(or_(Prompt.name.ilike(q), Prompt.description.ilike(q)))
        if is_active is not None:
            stmt = stmt.where(Prompt.is_active == is_active)
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def list(
        self,
        skip: int = 0,
        limit: int = 20,
        query: Optional[str] = None,
        is_active: Optional[bool] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = "asc",
    ) -> List[Prompt]:
        stmt = select(Prompt)
        if query:
            q = f"%{query}%"
            stmt = stmt.where(or_(Prompt.name.ilike(q), Prompt.description.ilike(q)))
        if is_active is not None:
            stmt = stmt.where(Prompt.is_active == is_active)
        order_col = getattr(Prompt, sort_by, None) if sort_by else Prompt.id
        if order_col is not None:
            stmt = stmt.order_by(order_col.desc() if sort_order == "desc" else order_col.asc())
        else:
            stmt = stmt.order_by(Prompt.id.asc())
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get(self, id: int) -> Optional[Prompt]:
        result = await self.db.execute(select(Prompt).where(Prompt.id == id))
        return result.scalar_one_or_none()

    async def clear_default_except(self, exclude_id: Optional[int] = None) -> None:
        """Đặt is_default=False cho tất cả prompt trừ exclude_id (dùng khi set một prompt làm mặc định)."""
        stmt = update(Prompt).where(Prompt.is_default == True).values(is_default=False)
        if exclude_id is not None:
            stmt = stmt.where(Prompt.id != exclude_id)
        await self.db.execute(stmt)
        await self.db.commit()

    async def create(self, data: Dict[str, Any]) -> Prompt:
        if data.get("is_default"):
            await self.clear_default_except(exclude_id=None)
        item = Prompt(**data)
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Prompt]:
        if data.get("is_default"):
            await self.clear_default_except(exclude_id=id)
        result = await self.db.execute(select(Prompt).where(Prompt.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return None
        for key, value in data.items():
            setattr(item, key, value)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def delete(self, id: int) -> bool:
        result = await self.db.execute(select(Prompt).where(Prompt.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True
