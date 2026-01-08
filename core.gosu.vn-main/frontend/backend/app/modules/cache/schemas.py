from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CacheBase(BaseModel):
    key: str
    value: str
    ttl: Optional[int] = None

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
