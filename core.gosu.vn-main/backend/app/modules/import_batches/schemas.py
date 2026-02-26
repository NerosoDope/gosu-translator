"""Import Batches Schemas"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ImportBatchResponse(BaseModel):
    id: int
    source_type: str
    game_id: Optional[int] = None
    filename: str
    total_rows: int
    created_count: int
    error_count: int
    user_id: Optional[int] = None
    created_at: Optional[datetime] = None


class ImportBatchRollbackResponse(BaseModel):
    success: bool
    batch_id: int
    deleted_count: int
    message: str
