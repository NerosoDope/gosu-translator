"""
Module: users.schemas
Purpose:
    - Pydantic schemas cho User management
    - Request/Response models cho user APIs
Context:
    - Used by user management endpoints
    - Validation và serialization
Used by:
    - app/modules/users/router.py for API endpoints
    - Frontend for type safety

See also:
    - app/modules/users/models.py for User model
"""

from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class UserBase(BaseModel):
    """User Base Schema - Common fields"""
    email: EmailStr
    full_name: Optional[str] = None
    avatar: Optional[str] = None


class UserCreate(UserBase):
    """User Create Schema - For creating new users"""
    id: Optional[int] = None  # Optional, nếu không có sẽ lấy từ apis.gosu.vn
    password: Optional[str] = None  # Plain password (will be hashed)


class UserUpdate(BaseModel):
    """User Update Schema - For updating existing users"""
    full_name: Optional[str] = None
    avatar: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None  # Plain password (will be hashed)


class UserResponse(UserBase):
    """User Response Schema - For API responses"""
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """User List Response Schema - Paginated user list"""
    items: List[UserResponse]
    total: int
    page: int
    per_page: int
    pages: int

