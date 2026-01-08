"""
Module: rbac.models
Purpose:
    - Define database models for Role-Based Access Control
    - Support multi-tenant via Organization model
Context:
    - RBAC is core security mechanism for all modules
    - Permissions follow format: {module}:{resource}:{action}
    - Roles can have multiple permissions (many-to-many)
    - Users can have multiple roles (many-to-many via UserRole)
Used by:
    - RBAC service for permission checks
    - All modules requiring authorization
    - Frontend for permission-based UI rendering

See also:
    - docs/rbac.md for RBAC architecture
    - docs/architecture.md for security model
"""

from sqlalchemy import Column, Integer, BigInteger, String, ForeignKey, Boolean, DateTime, Table, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

# Many-to-many relationship table
role_permission = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)


class Role(Base):
    """Role Model - Vai trò trong hệ thống RBAC"""
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)  # ADMIN, MANAGER, EMPLOYEE...
    name = Column(String(255), nullable=False)
    description = Column(Text)
    is_system = Column(Boolean, default=False)  # System roles cannot be deleted
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    permissions = relationship("Permission", secondary=role_permission, back_populates="roles")
    user_roles = relationship("UserRole", back_populates="role")
    
    def __repr__(self):
        return f"<Role(code={self.code}, name={self.name})>"


class Permission(Base):
    """Permission Model - Quyền truy cập trong hệ thống RBAC"""
    __tablename__ = "permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, index=True, nullable=False)  # module:resource:action
    name = Column(String(255), nullable=False)
    description = Column(Text)
    module = Column(String(50), index=True)  # erp_hr, gamification, performance...
    resource = Column(String(100))  # users, quests, rewards...
    action = Column(String(50))  # read, write, delete, approve...
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    roles = relationship("Role", secondary=role_permission, back_populates="permissions")
    
    def __repr__(self):
        return f"<Permission(code={self.code}, module={self.module})>"


class UserRole(Base):
    """UserRole Model - Gán role cho user"""
    __tablename__ = "user_roles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)  # For multi-org
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    assigned_by = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="user_roles")
    role = relationship("Role", back_populates="user_roles")
    
    def __repr__(self):
        return f"<UserRole(user_id={self.user_id}, role_id={self.role_id})>"


class Organization(Base):
    """Organization Model - Tổ chức (cho multi-tenant support)"""
    __tablename__ = "organizations"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Organization(code={self.code}, name={self.name})>"

