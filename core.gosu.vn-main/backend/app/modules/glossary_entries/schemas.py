"""
Glossary_Entries Schemas - Pydantic schemas

Author: GOSU Development Team
Version: 1.0.0
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Glossary_EntriesBase(BaseModel):
    """Base schema cho glossary_entries"""
    # TODO: Add fields
    pass


class Glossary_EntriesCreate(Glossary_EntriesBase):
    """Schema để tạo glossary_entries mới"""
    pass


class Glossary_EntriesUpdate(BaseModel):
    """Schema để cập nhật glossary_entries"""
    # TODO: Add optional fields
    pass


class Glossary_EntriesResponse(Glossary_EntriesBase):
    """Schema response cho glossary_entries"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
