from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class GameCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True

class GameCategoryCreate(GameCategoryBase):
    pass

class GameCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class GameCategoryResponse(GameCategoryBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True
