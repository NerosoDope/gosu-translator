"""
Module: users.models
Purpose:
    - Define User model for core platform
    - Store user information synced from apis.gosu.vn
    - Support RBAC via UserRole relationship
Context:
    - Users are synced from external GOSU API after login
    - User model is required for RBAC UserRole foreign keys
    - Simplified compared to ERP system (no department, position, etc.)
Used by:
    - Auth module for user sync after login
    - RBAC module for user-role assignments
    - All modules requiring user information

See also:
    - docs/architecture.md for user sync flow
    - app/modules/rbac/models.py for UserRole relationship
"""

from sqlalchemy import Column, BigInteger, String, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class User(Base):
    """
    User Model - Model chính cho users trong Core Platform
    
    Model này lưu trữ thông tin cơ bản của user:
    - Thông tin cá nhân: email, full_name, avatar
    - Trạng thái: is_active
    - Timestamps: created_at, updated_at
    
    Attributes:
        id (BigInteger): Primary key (từ apis.gosu.vn)
        email (str): Email (unique, indexed, required) - dùng để login
        full_name (str): Tên đầy đủ (optional)
        avatar (str): URL đến avatar image (optional)
        is_active (bool): Trạng thái hoạt động (default: True)
        created_at (datetime): Thời gian tạo record
        updated_at (datetime): Thời gian cập nhật cuối cùng
    
    Relationships:
        user_roles: List of UserRole objects (one-to-many)
    
    Example:
        user = User(
            id=123,
            email="user@gosu.vn",
            full_name="Nguyễn Văn A"
        )
        db.add(user)
        await db.commit()
    
    Note:
        - ID được lấy từ apis.gosu.vn (không auto-increment)
        - Email được dùng để login và sync với external API
        - User được sync tự động sau khi login thành công
    """
    __tablename__ = "users"
    
    id = Column(BigInteger, primary_key=True, index=True)  # ID từ apis.gosu.vn
    email = Column(String(255), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=True)  # Hashed password (bcrypt)
    full_name = Column(String(255), nullable=True)
    avatar = Column(Text, nullable=True)  # URL đến avatar image
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    user_roles = relationship("UserRole", foreign_keys="[UserRole.user_id]", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email})>"

