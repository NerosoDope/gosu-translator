from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DictionaryBase(BaseModel):
    code: str
    value: str
    description: Optional[str] = None
    is_active: bool = True

class DictionaryCreate(DictionaryBase):
    pass

class DictionaryUpdate(BaseModel):
    value: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class DictionaryResponse(DictionaryBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True
