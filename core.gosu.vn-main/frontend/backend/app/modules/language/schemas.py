from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime

class LanguageBase(BaseModel):
    code: str
    name: str
    is_active: bool = True

class LanguageCreate(LanguageBase):
    pass

class LanguageUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    is_active: Optional[bool] = None

class LanguageResponse(LanguageBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    source_pairs_count: int = 0
    target_pairs_count: int = 0

    class Config:
        orm_mode = True

# Language Pair Schemas
class LanguagePairBase(BaseModel):
    source_language_id: int
    target_language_id: int
    is_bidirectional: bool = False
    is_active: bool = True
    organization_id: Optional[int] = None

    @validator('target_language_id')
    def source_target_not_same(cls, v, values):
        if 'source_language_id' in values and v == values['source_language_id']:
            raise ValueError('Source and target languages cannot be the same')
        return v

class LanguagePairCreate(LanguagePairBase):
    pass

class LanguagePairUpdate(BaseModel):
    source_language_id: Optional[int] = None
    target_language_id: Optional[int] = None
    is_bidirectional: Optional[bool] = None
    is_active: Optional[bool] = None
    organization_id: Optional[int] = None

class LanguagePairResponse(LanguagePairBase):
    id: int
    source_language: LanguageResponse
    target_language: LanguageResponse
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True

# Combined response for language with its available pairs
class LanguageWithPairsResponse(LanguageResponse):
    source_pairs_count: int = 0
    target_pairs_count: int = 0

    class Config:
        orm_mode = True

# List response with pagination
class LanguageListResponse(BaseModel):
    """Language List Response Schema - Paginated language list"""
    items: List[LanguageResponse]
    total: int
    page: int
    per_page: int
    pages: int

class LanguagePairListResponse(BaseModel):
    """Language Pair List Response Schema - Paginated language pair list"""
    items: List[LanguagePairResponse]
    total: int
    page: int
    per_page: int
    pages: int
