"""
Game_Glossary Schemas - Pydantic schemas

Author: GOSU Development Team
Version: 1.0.0
"""

from pydantic import BaseModel
from typing import Optional, List
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
    import_id: Optional[int] = None
    imported_at: Optional[datetime] = None  # Thời gian import từ import_batches.created_at
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExcelUploadResponse(BaseModel):
    """Schema response cho upload Excel"""
    success: bool
    total_rows: int
    created_count: int
    skipped_count: int = 0  # Số dòng bỏ qua vì đã tồn tại (term + translated_term + language_pair + game_id)
    error_count: int
    errors: List[str] = []
    import_id: Optional[int] = None  # ID lô import - dùng để rollback khi cần
