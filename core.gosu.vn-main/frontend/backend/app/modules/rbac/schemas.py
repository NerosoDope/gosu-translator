"""
RBAC Schemas - Pydantic schemas cho RBAC

Author: GOSU Development Team
Version: 1.0.0
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class RoleBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    is_system: bool = False
    is_active: bool = True


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class RoleResponse(RoleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    permissions_count: Optional[int] = None  # Số lượng permissions của role
    
    class Config:
        from_attributes = True


class PermissionBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    module: Optional[str] = None
    resource: Optional[str] = None
    action: Optional[str] = None
    is_active: bool = True


class PermissionCreate(PermissionBase):
    pass


class PermissionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    module: Optional[str] = None
    resource: Optional[str] = None
    action: Optional[str] = None
    is_active: Optional[bool] = None


class PermissionResponse(PermissionBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UserRoleCreate(BaseModel):
    user_id: int
    role_id: int
    organization_id: Optional[int] = None


class UserRoleResponse(BaseModel):
    id: int
    user_id: int
    role_id: int
    organization_id: Optional[int] = None
    assigned_at: datetime
    assigned_by: Optional[int] = None
    
    class Config:
        from_attributes = True


class RoleWithPermissions(RoleResponse):
    permissions: List[PermissionResponse] = []

