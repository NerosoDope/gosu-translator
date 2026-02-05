"""
Game Schemas - Pydantic schemas

Author: GOSU Development Team
Version: 1.0.0
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class GameBase(BaseModel):
    """Base schema cho game"""
    name: str
    description: Optional[str] = None
    game_category_id: int
    is_active: bool = True


class GameCreate(GameBase):
    """Schema để tạo game mới"""
    pass


class GameUpdate(BaseModel):
    """Schema để cập nhật game"""
    name: Optional[str] = None
    description: Optional[str] = None
    game_category_id: Optional[int] = None
    is_active: Optional[bool] = None


class GameResponse(GameBase):
    """Schema response cho game"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True