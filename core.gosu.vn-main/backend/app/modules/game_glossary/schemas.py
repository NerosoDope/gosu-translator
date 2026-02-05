"""
Game_Glossary Schemas - Pydantic schemas

Author: GOSU Development Team
Version: 1.0.0
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Game_GlossaryBase(BaseModel):
    """Base schema cho game_glossary"""
    term: str
    translated_term: str
    language_pair: str
    usage_count: int
    game_id: int
    is_active: bool


class Game_GlossaryCreate(Game_GlossaryBase):
    """Schema để tạo game_glossary mới"""
    pass


class Game_GlossaryUpdate(BaseModel):
    """Schema để cập nhật game_glossary"""
    term: Optional[str] = None
    translated_term: Optional[str] = None
    language_pair: Optional[str] = None
    usage_count: Optional[int] = None
    game_id: Optional[int] = None
    is_active: Optional[bool] = None


class Game_GlossaryResponse(Game_GlossaryBase):
    """Schema response cho game_glossary"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
