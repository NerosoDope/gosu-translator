"""
Global_Glossary Schemas - Pydantic schemas

Author: GOSU Development Team
Version: 1.0.0
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Global_GlossaryBase(BaseModel):
    """Base schema cho global_glossary"""
    term: str
    translated_term: str
    language_pair: str
    game_category_id: int
    usage_count: Optional[int] = 0
    is_active: Optional[bool] = True


class Global_GlossaryCreate(Global_GlossaryBase):
    """Schema để tạo global_glossary mới"""
    pass


class Global_GlossaryUpdate(BaseModel):
    """Schema để cập nhật global_glossary"""
    term: Optional[str] = None
    translated_term: Optional[str] = None
    language_pair: Optional[str] = None
    game_category_id: Optional[int] = None
    usage_count: Optional[int] = None
    is_active: Optional[bool] = None


class Global_GlossaryResponse(Global_GlossaryBase):
    """Schema response cho global_glossary"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
