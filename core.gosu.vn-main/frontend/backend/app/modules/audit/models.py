"""
Module: audit.models - Audit Log Model

Module này định nghĩa AuditLog model để lưu trữ audit trail.

Mục đích:
    - Lưu trữ log tất cả các thao tác quan trọng trong hệ thống
    - Tracking và compliance
    - Debug và troubleshooting

Ngữ cảnh:
    - Audit logs được tạo cho CRUD operations
    - Authentication events (login, logout)
    - Permission changes
    - System configuration changes

Được sử dụng bởi:
    - AuditService để ghi logs
    - Audit router để query logs
    - Frontend để hiển thị activity history

Xem thêm:
    - app/modules/audit/service.py cho business logic
    - app/modules/audit/router.py cho API endpoints
"""

from sqlalchemy import Column, Integer, BigInteger, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class AuditLog(Base):
    """
    AuditLog Model - Audit log record
    
    Model này lưu trữ audit trail cho các thao tác quan trọng trong hệ thống.
    
    Attributes:
        id (int): Primary key
        action (str): Action name (ví dụ: "users.create", "roles.update")
        module (str): Module name (ví dụ: "users", "rbac", "auth")
        resource_type (str): Resource type (ví dụ: "User", "Role", "Permission")
        resource_id (int): Resource ID (nullable)
        user_id (int): User ID thực hiện action (nullable, foreign key)
        ip_address (str): IP address của client
        user_agent (str): User agent string
        details (JSON): Additional details (request data, response data, etc.)
        created_at (datetime): Timestamp
    """
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), index=True, nullable=False)  # create, update, delete, login, logout
    module = Column(String(50), index=True, nullable=False)  # users, rbac, auth, etc.
    resource_type = Column(String(50), nullable=True)  # User, Role, Permission
    resource_id = Column(BigInteger, nullable=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=True, index=True)
    ip_address = Column(String(45), nullable=True)  # IPv6 support
    user_agent = Column(Text, nullable=True)
    details = Column(JSON, nullable=True)  # Additional data (request/response, error messages, etc.)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, action={self.action}, module={self.module}, user_id={self.user_id})>"

