"""
Module: settings.schemas - Pydantic schemas cho Settings

Module này định nghĩa các Pydantic schemas cho request/response validation.

Mục đích:
    - Validate input data cho API endpoints
    - Serialize response data
    - Type safety cho settings operations

Author: GOSU Development Team
Version: 1.0.0
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any
from datetime import datetime
from app.modules.settings.models import SettingCategory, SettingType


class SettingBase(BaseModel):
    """Base schema cho Setting"""
    key: str = Field(..., description="Key của setting (unique)")
    category: SettingCategory = Field(..., description="Danh mục setting")
    name: str = Field(..., description="Tên hiển thị")
    description: Optional[str] = Field(None, description="Mô tả")
    value: Optional[str] = Field(None, description="Giá trị")
    type: SettingType = Field(default=SettingType.STRING, description="Loại dữ liệu")
    is_encrypted: bool = Field(default=False, description="Có mã hóa không")
    is_public: bool = Field(default=False, description="Có public không")
    is_active: bool = Field(default=True, description="Trạng thái active")
    order: int = Field(default=0, description="Thứ tự hiển thị")
    meta: Optional[Dict[str, Any]] = Field(None, description="Metadata bổ sung")

    @field_validator("key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        """Validate key format"""
        if not v or not v.strip():
            raise ValueError("Key không được để trống")
        return v.lower().strip().replace(" ", "_")


class SettingCreate(SettingBase):
    """Schema cho tạo setting mới"""
    pass


class SettingUpdate(BaseModel):
    """Schema cho cập nhật setting"""
    name: Optional[str] = None
    description: Optional[str] = None
    value: Optional[str] = None
    type: Optional[SettingType] = None
    is_encrypted: Optional[bool] = None
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None
    order: Optional[int] = None
    meta: Optional[Dict[str, Any]] = None


class SettingResponse(SettingBase):
    """Schema cho response setting"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SettingValueUpdate(BaseModel):
    """Schema cho cập nhật chỉ value"""
    value: str


class BulkSettingsUpdate(BaseModel):
    """Schema cho bulk update settings"""
    settings: Dict[str, str] = Field(..., description="Dictionary với key-value pairs")

