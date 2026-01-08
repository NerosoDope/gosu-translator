from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class GameGlossaryBase(BaseModel):
    term: str
    definition: str
    category_id: Optional[int] = None
    is_active: bool = True

class GameGlossaryCreate(GameGlossaryBase):
    pass

class GameGlossaryUpdate(BaseModel):
    term: Optional[str] = None
    definition: Optional[str] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None

class GameGlossaryResponse(GameGlossaryBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True
