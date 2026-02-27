"""
Module: audit.service - Audit Service

Module này cung cấp AuditService để ghi và query audit logs.

Mục đích:
    - Ghi audit logs cho các thao tác quan trọng
    - Query và filter audit logs
    - Cung cấp data cho audit log UI

Ngữ cảnh:
    - Service được sử dụng bởi các modules khác để log actions
    - Router sử dụng service để query logs
    - Frontend sử dụng API để hiển thị logs

Được sử dụng bởi:
    - Các modules (users, rbac, auth) để log actions
    - Audit router để query logs
    - Frontend audit log management UI

Xem thêm:
    - app/modules/audit/models.py cho AuditLog model
    - app/modules/audit/router.py cho API endpoints
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.modules.audit.models import AuditLog


class AuditService:
    """Service để ghi và query audit logs"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def log(
        self,
        action: str,
        module: str,
        user_id: Optional[int] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        """
        Log - Ghi audit log
        
        Args:
            action: Action name (create, update, delete, login, logout)
            module: Module name (users, rbac, auth)
            user_id: User ID thực hiện action
            resource_type: Resource type (User, Role, Permission)
            resource_id: Resource ID
            ip_address: IP address
            user_agent: User agent string
            details: Additional details (JSON)
        
        Returns:
            AuditLog: Created audit log
        """
        audit_log = AuditLog(
            action=action,
            module=module,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details,
        )
        self.db.add(audit_log)
        await self.db.flush()
        return audit_log
    
    async def get_logs(
        self,
        skip: int = 0,
        limit: int = 100,
        user_id: Optional[int] = None,
        module: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None,
    ) -> List[AuditLog]:
        """
        Get Logs - Query audit logs với filters

        Args:
            skip: Pagination offset
            limit: Pagination limit
            user_id: Filter by user ID
            module: Filter by module
            action: Filter by action
            resource_type: Filter by resource type
            start_date: Filter by start date
            end_date: Filter by end date
            search: Tìm trong action, module, resource_type (ILIKE)

        Returns:
            List[AuditLog]: List of audit logs
        """
        query = select(AuditLog).options(selectinload(AuditLog.user))

        # Apply filters
        conditions = []
        if user_id:
            conditions.append(AuditLog.user_id == user_id)
        if module:
            conditions.append(AuditLog.module == module)
        if action:
            conditions.append(AuditLog.action == action)
        if resource_type:
            conditions.append(AuditLog.resource_type == resource_type)
        if start_date:
            conditions.append(AuditLog.created_at >= start_date)
        if end_date:
            conditions.append(AuditLog.created_at <= end_date)
        if search and search.strip():
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    AuditLog.action.ilike(term),
                    AuditLog.module.ilike(term),
                    AuditLog.resource_type.ilike(term),
                )
            )

        if conditions:
            query = query.where(and_(*conditions))

        # Order by created_at desc
        query = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def count_logs(
        self,
        user_id: Optional[int] = None,
        module: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None,
    ) -> int:
        """
        Count Logs - Đếm số lượng audit logs với filters

        Args:
            Same as get_logs

        Returns:
            int: Total count
        """
        query = select(func.count(AuditLog.id))

        # Apply filters (cùng điều kiện với get_logs)
        conditions = []
        if user_id:
            conditions.append(AuditLog.user_id == user_id)
        if module:
            conditions.append(AuditLog.module == module)
        if action:
            conditions.append(AuditLog.action == action)
        if resource_type:
            conditions.append(AuditLog.resource_type == resource_type)
        if start_date:
            conditions.append(AuditLog.created_at >= start_date)
        if end_date:
            conditions.append(AuditLog.created_at <= end_date)
        if search and search.strip():
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    AuditLog.action.ilike(term),
                    AuditLog.module.ilike(term),
                    AuditLog.resource_type.ilike(term),
                )
            )

        if conditions:
            query = query.where(and_(*conditions))

        result = await self.db.execute(query)
        return result.scalar() or 0

