from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from .repository import PromptsRepository

class PromptsService:
    def __init__(self, db: AsyncSession):
        self.repo = PromptsRepository(db)

    async def list(
        self,
        skip: int = 0,
        limit: int = 20,
        query: Optional[str] = None,
        is_active: Optional[bool] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = "asc",
    ):
        total = await self.repo.count(query=query, is_active=is_active)
        items = await self.repo.list(
            skip=skip,
            limit=limit,
            query=query,
            is_active=is_active,
            sort_by=sort_by or "id",
            sort_order=sort_order or "asc",
        )
        page = (skip // limit) + 1 if limit else 1
        per_page = limit
        pages = (total + per_page - 1) // per_page if per_page else 0
        return {
            "data": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": pages,
        }

    async def get(self, id: int):
        return await self.repo.get(id)

    async def create(self, data: Dict[str, Any]):
        return await self.repo.create(data)

    async def update(self, id: int, data: Dict[str, Any]):
        return await self.repo.update(id, data)

    async def delete(self, id: int):
        return await self.repo.delete(id)
