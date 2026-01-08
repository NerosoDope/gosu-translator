"""
Module: audit.schemas - Pydantic schemas cho Audit Log

Module này định nghĩa Pydantic schemas cho audit log API.

Author: GOSU Development Team
Version: 1.0.0
"""

from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class AuditLogResponse(BaseModel):
    """Response schema cho AuditLog"""
    id: int
    action: str
    module: str
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    user_id: Optional[int] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime
    
    # User info (from relationship)
    user_email: Optional[str] = None
    
    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    """Response schema cho list audit logs"""
    items: list[AuditLogResponse]
    total: int
    skip: int
    limit: int

