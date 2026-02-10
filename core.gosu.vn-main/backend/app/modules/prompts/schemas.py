from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class PromptBase(BaseModel):
    name: str
    content: str
    description: Optional[str] = None
    is_active: bool = True

class PromptCreate(PromptBase):
    pass

class PromptUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class PromptResponse(PromptBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class PromptListResponse(BaseModel):
    data: List[PromptResponse]
    total: int
    page: int
    per_page: int
    pages: int
