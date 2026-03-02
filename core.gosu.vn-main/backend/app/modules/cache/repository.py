import logging
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, update, text as sa_text
from .models import Cache

logger = logging.getLogger(__name__)

class CacheRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(
        self,
        skip: int = 0,
        limit: int = 20,
        query_str: Optional[str] = None,
        origin: Optional[str] = None,
        sort_by: str = "id",
        sort_order: str = "asc",
    ) -> Tuple[List[Cache], int]:
        """List cache with optional search on key and filter by origin. Returns (items, total)."""
        q = select(Cache)
        if query_str and query_str.strip():
            term = f"%{query_str.strip()}%"
            q = q.where(Cache.key.ilike(term))
        if origin and origin.strip():
            q = q.where(Cache.key.like(f"translate:{origin.strip():s}:%"))
        order_col = getattr(Cache, sort_by, Cache.id)
        q = q.order_by(order_col.desc() if sort_order == "desc" else order_col.asc())
        count_q = select(func.count()).select_from(Cache)
        if query_str and query_str.strip():
            count_q = count_q.where(Cache.key.ilike(term))
        if origin and origin.strip():
            count_q = count_q.where(Cache.key.like(f"translate:{origin.strip():s}:%"))
        total = (await self.db.execute(count_q)).scalar() or 0
        result = await self.db.execute(q.offset(skip).limit(limit))
        return result.scalars().all(), total

    async def list_all(
        self,
        query_str: Optional[str] = None,
        origin: Optional[str] = None,
        sort_by: str = "id",
        sort_order: str = "asc",
        limit: int = 100000,
    ) -> List[Cache]:
        """List all cache for export."""
        q = select(Cache)
        if query_str and query_str.strip():
            q = q.where(Cache.key.ilike(f"%{query_str.strip()}%"))
        if origin and origin.strip():
            q = q.where(Cache.key.like(f"translate:{origin.strip():s}:%"))
        order_col = getattr(Cache, sort_by, Cache.id)
        q = q.order_by(order_col.desc() if sort_order == "desc" else order_col.asc())
        result = await self.db.execute(q.limit(limit))
        return result.scalars().all()

    async def get(self, id: int) -> Optional[Cache]:
        result = await self.db.execute(select(Cache).where(Cache.id == id))
        return result.scalar_one_or_none()

    async def get_by_key(self, key: str) -> Optional[Cache]:
        """Trả về cache entry chưa hết hạn.
        - ttl IS NOT NULL: so sánh created_at + ttl giây với now()
        - ttl IS NULL: áp dụng TTL mặc định 86400 giây (1 ngày)
        """
        result = await self.db.execute(
            select(Cache).where(
                Cache.key == key,
                # Chưa hết hạn theo ttl rõ ràng hoặc mặc định 1 ngày
                # Dùng ::text cast vì ttl là BigInteger, không dùng || trực tiếp với string
                (Cache.ttl.isnot(None) & (
                    Cache.created_at + sa_text("(cache.ttl::text || ' seconds')::interval") > func.now()
                ))
                |
                (Cache.ttl.is_(None) & (
                    Cache.created_at + sa_text("interval '86400 seconds'") > func.now()
                )),
            )
        )
        return result.scalar_one_or_none()

    async def create(self, data: Dict[str, Any]) -> Cache:
        """
        Upsert cache entry theo cách thông thường (không dùng ON CONFLICT để tránh
        phụ thuộc vào tên unique constraint của PostgreSQL).
        - Nếu key đã tồn tại: cập nhật value, ttl, reset created_at để gia hạn TTL.
        - Nếu chưa tồn tại: tạo mới.
        """
        key = data.get("key")
        try:
            # Tìm entry hiện tại (kể cả đã hết hạn) theo key
            result = await self.db.execute(select(Cache).where(Cache.key == key))
            existing = result.scalar_one_or_none()

            if existing:
                # Cập nhật và reset created_at để gia hạn TTL
                await self.db.execute(
                    update(Cache)
                    .where(Cache.key == key)
                    .values(
                        value=data.get("value"),
                        ttl=data.get("ttl"),
                        created_at=func.now(),
                        updated_at=func.now(),
                    )
                )
                await self.db.commit()
                logger.debug("Cache updated key=%s", (key or "")[:40])
                return existing
            else:
                cache = Cache(
                    key=data.get("key"),
                    value=data.get("value"),
                    ttl=data.get("ttl"),
                )
                self.db.add(cache)
                await self.db.commit()
                await self.db.refresh(cache)
                logger.debug("Cache created key=%s", (key or "")[:40])
                return cache
        except Exception as e:
            logger.error("Cache create failed key=%s: %s", (key or "")[:40], e)
            await self.db.rollback()
            raise

    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Cache]:
        result = await self.db.execute(select(Cache).where(Cache.id == id))
        cache = result.scalar_one_or_none()
        if not cache:
            return None
        for key, value in data.items():
            setattr(cache, key, value)
        await self.db.commit()
        await self.db.refresh(cache)
        return cache

    async def delete(self, id: int) -> bool:
        result = await self.db.execute(select(Cache).where(Cache.id == id))
        cache = result.scalar_one_or_none()
        if not cache:
            return False
        await self.db.delete(cache)
        await self.db.commit()
        return True

    async def delete_expired(self) -> int:
        """Xóa tất cả cache entries đã hết TTL.
        - ttl IS NOT NULL: so sánh created_at + ttl giây với now()
        - ttl IS NULL: áp dụng TTL mặc định 86400 giây (1 ngày)
        Trả về số bản ghi đã xóa.
        """
        stmt = (
            delete(Cache)
            .where(
                # ttl có giá trị rõ ràng: hết hạn theo ttl
                (Cache.ttl.isnot(None) & (
                    Cache.created_at + sa_text("(cache.ttl::text || ' seconds')::interval") <= func.now()
                ))
                |
                # ttl NULL: dùng mặc định 1 ngày
                (Cache.ttl.is_(None) & (
                    Cache.created_at + sa_text("interval '86400 seconds'") <= func.now()
                ))
            )
            .returning(Cache.id)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return len(result.fetchall())
