"""
Job Schemas - Pydantic schemas

Author: GOSU Development Team
Version: 1.0.0
"""

from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class JobBase(BaseModel):
    """Base schema cho job"""
    job_code: str
    job_type: str
    status: str
    priority: Optional[int] = 5
    user_id: int
    team_id: Optional[int] = None
    game_id: Optional[int] = None
    game_genre: Optional[str] = None
    source_lang: Optional[str] = None
    target_lang: Optional[str] = None
    progress: Optional[int] = 0
    retry_count: Optional[int] = 0
    max_retry: Optional[int] = 3
    payload: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


class JobCreate(JobBase):
    """Schema để tạo job mới"""
    pass


class JobUpdate(JobBase):
    """Schema để cập nhật job"""
    job_code: Optional[str] = None
    job_type: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[int] = None
    user_id: Optional[int] = None
    team_id: Optional[int] = None
    game_id: Optional[int] = None
    game_genre: Optional[str] = None
    source_lang: Optional[str] = None
    target_lang: Optional[str] = None
    progress: Optional[int] = None
    retry_count: Optional[int] = None
    max_retry: Optional[int] = None
    payload: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class JobResponse(JobBase):
    """Schema response cho job"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    creator_name: Optional[str] = None  # Tên người tạo job (từ users.full_name)
    
    class Config:
        from_attributes = True
