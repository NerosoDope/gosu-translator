import io
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from .repository import CacheRepository
from .models import Cache

def _cache_to_dict(c: Cache) -> Dict[str, Any]:
    return {
        "id": c.id,
        "key": c.key,
        "value": c.value,
        "ttl": c.ttl,
        "origin": getattr(c, "origin", None),
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }

class CacheService:
    def __init__(self, db: AsyncSession):
        self.repo = CacheRepository(db)

    async def list(
        self,
        skip: int = 0,
        limit: int = 20,
        query: Optional[str] = None,
        origin: Optional[str] = None,
        sort_by: str = "id",
        sort_order: str = "asc",
    ) -> Dict[str, Any]:
        """List cache with search, origin filter and pagination. Returns { items, total, page, per_page, pages }."""
        items, total = await self.repo.list(
            skip=skip, limit=limit, query_str=query, origin=origin, sort_by=sort_by, sort_order=sort_order
        )
        pages = (total + limit - 1) // limit if limit else 0
        page = (skip // limit) + 1 if limit else 1
        return {
            "items": [_cache_to_dict(c) for c in items],
            "total": total,
            "page": page,
            "per_page": limit,
            "pages": pages,
        }

    async def export_excel(self, query: Optional[str] = None, origin: Optional[str] = None) -> bytes:
        """Export cache to Excel. Returns bytes of .xlsx file."""
        try:
            import openpyxl
        except ImportError:
            raise
        items = await self.repo.list_all(query_str=query, origin=origin, limit=100000)
        workbook = openpyxl.Workbook()
        worksheet = workbook.active
        worksheet.title = "Cache"
        headers = ["id", "key", "value", "ttl", "origin", "created_at", "updated_at"]
        worksheet.append(headers)
        for c in items:
            worksheet.append([
                c.id,
                c.key,
                (c.value[:5000] + "..." if c.value and len(c.value) > 5000 else c.value),
                c.ttl,
                getattr(c, "origin", None),
                str(c.created_at) if c.created_at else None,
                str(c.updated_at) if c.updated_at else None,
            ])
        output = io.BytesIO()
        workbook.save(output)
        output.seek(0)
        return output.read()

    async def get(self, id: int):
        return await self.repo.get(id)

    async def get_by_key(self, key: str):
        return await self.repo.get_by_key(key)

    async def create(self, data: Dict[str, Any]):
        return await self.repo.create(data)

    async def update(self, id: int, data: Dict[str, Any]):
        return await self.repo.update(id, data)

    async def delete(self, id: int):
        return await self.repo.delete(id)

    async def cleanup_expired(self) -> int:
        """Xóa toàn bộ cache entries đã hết TTL. Trả về số bản ghi bị xóa."""
        return await self.repo.delete_expired()
