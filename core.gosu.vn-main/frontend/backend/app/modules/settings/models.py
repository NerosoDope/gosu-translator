"""
Module: settings.models - Models cho Settings Management

Module này định nghĩa các database models cho quản lý settings/cấu hình hệ thống.

Mục đích:
    - Lưu trữ key-value settings
    - Hỗ trợ nhiều loại dữ liệu (string, integer, boolean, json, text)
    - Phân loại settings theo category
    - Hỗ trợ encryption cho sensitive data
    - Public settings cho frontend

Ngữ cảnh:
    - Settings được sử dụng để lưu cấu hình hệ thống
    - Có thể được truy cập từ frontend (nếu is_public=True)
    - Sensitive settings (passwords, API keys) được mã hóa

Được sử dụng bởi:
    - SettingsService để CRUD operations
    - Settings Router để expose API endpoints

Xem thêm:
    - app/modules/settings/service.py cho business logic
    - app/modules/settings/router.py cho API endpoints

Author: GOSU Development Team
Version: 1.0.0
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Enum as SQLEnum, JSON
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
import enum
from app.db.base import Base


class SettingCategory(str, enum.Enum):
    """Danh mục settings"""
    GENERAL = "general"
    EMAIL = "email"
    SECURITY = "security"
    SYSTEM = "system"
    INTEGRATION = "integration"
    NOTIFICATION = "notification"


class SettingType(str, enum.Enum):
    """Loại dữ liệu của setting"""
    STRING = "string"
    INTEGER = "integer"
    BOOLEAN = "boolean"
    JSON = "json"
    TEXT = "text"


class Setting(Base):
    """
    Model cho Settings - Lưu trữ cấu hình hệ thống
    
    Attributes:
        id (int): Primary key
        key (str): Key của setting (unique, indexed)
        category (SettingCategory): Danh mục setting
        name (str): Tên hiển thị
        description (str): Mô tả
        value (str): Giá trị (lưu dạng text, parse theo type)
        type (SettingType): Loại dữ liệu
        is_encrypted (bool): Có mã hóa không (cho password, API keys)
        is_public (bool): Có public không (frontend có thể đọc)
        is_active (bool): Trạng thái active
        order (int): Thứ tự hiển thị
        metadata (dict): Metadata bổ sung (validation rules, options, etc.)
        created_at (datetime): Thời gian tạo
        updated_at (datetime): Thời gian cập nhật
    """
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, nullable=False, index=True, comment="Key của setting (unique)")
    category = Column(
        SQLEnum(SettingCategory, native_enum=False),
        nullable=False,
        index=True,
        comment="Danh mục setting"
    )
    name = Column(String(255), nullable=False, comment="Tên hiển thị")
    description = Column(Text, nullable=True, comment="Mô tả")
    value = Column(Text, nullable=True, comment="Giá trị (lưu dạng text, parse theo type)")
    type = Column(
        SQLEnum(SettingType, native_enum=False),
        nullable=False,
        default=SettingType.STRING,
        comment="Loại dữ liệu"
    )
    is_encrypted = Column(Boolean, default=False, nullable=False, comment="Có mã hóa không (cho password, API keys)")
    is_public = Column(Boolean, default=False, nullable=False, comment="Có public không (frontend có thể đọc)")
    is_active = Column(Boolean, default=True, nullable=False, comment="Trạng thái active")
    order = Column(Integer, default=0, nullable=False, comment="Thứ tự hiển thị")
    meta = Column(JSONB, nullable=True, comment="Metadata bổ sung (validation rules, options, etc.)")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    def __repr__(self):
        return f"<Setting(key='{self.key}', category='{self.category}', type='{self.type}')>"

