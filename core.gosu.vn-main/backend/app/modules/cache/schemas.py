from pydantic import BaseModel
from typing import Optional
from datetime import datetime

CACHE_DEFAULT_TTL = 86400  # 1 ngày (giây)

class CacheBase(BaseModel):
    key: str
    value: str
    ttl: Optional[int] = CACHE_DEFAULT_TTL

class CacheCreate(CacheBase):
    pass

class CacheUpdate(BaseModel):
    value: Optional[str] = None
    ttl: Optional[int] = None

class CacheResponse(CacheBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True
