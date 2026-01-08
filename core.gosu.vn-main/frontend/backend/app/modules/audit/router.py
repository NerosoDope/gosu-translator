"""
Module: audit.router - Router cho Audit Log API

Module này cung cấp các API endpoints cho audit log management.

Mục đích:
    - Expose audit log query APIs
    - Cung cấp filters và pagination
    - Export audit logs (future)

Ngữ cảnh:
    - Audit logs được tạo tự động bởi các modules
    - Admin users có thể xem và filter logs
    - Yêu cầu permission để truy cập

Được sử dụng bởi:
    - Frontend audit log management UI
    - Admin users để audit và compliance

Xem thêm:
    - app/modules/audit/service.py cho business logic
    - app/modules/audit/models.py cho AuditLog model
"""

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime
from app.db.session import get_db
from app.modules.users.models import User
from app.modules.users.dependencies import get_current_user
from app.modules.rbac.dependencies import require_permission
from app.modules.audit.service import AuditService
from app.modules.audit.schemas import AuditLogResponse, AuditLogListResponse
from app.modules.audit.models import AuditLog

router = APIRouter()


@router.get("/logs", response_model=AuditLogListResponse)
async def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[int] = Query(None),
    module: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read"))
):
    """
    Get Audit Logs - Lấy danh sách audit logs
    
    Endpoint này trả về danh sách audit logs với pagination và filters.
    Yêu cầu permission "audit:read" để truy cập.
    """
    service = AuditService(db)
    
    # Get logs
    logs = await service.get_logs(
        skip=skip,
        limit=limit,
        user_id=user_id,
        module=module,
        action=action,
        resource_type=resource_type,
        start_date=start_date,
        end_date=end_date,
    )
    
    # Get total count
    total = await service.count_logs(
        user_id=user_id,
        module=module,
        action=action,
        resource_type=resource_type,
        start_date=start_date,
        end_date=end_date,
    )
    
    # Convert to response format
    items = []
    for log in logs:
        item = AuditLogResponse(
            id=log.id,
            action=log.action,
            module=log.module,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            user_id=log.user_id,
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            details=log.details,
            created_at=log.created_at,
            user_email=log.user.email if log.user else None,
        )
        items.append(item)
    
    return AuditLogListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/logs/{log_id}", response_model=AuditLogResponse)
async def get_audit_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read"))
):
    """
    Get Audit Log - Lấy chi tiết audit log
    
    Endpoint này trả về thông tin chi tiết của một audit log.
    Yêu cầu permission "audit:read" để truy cập.
    """
    result = await db.execute(
        select(AuditLog)
        .options(selectinload(AuditLog.user))
        .where(AuditLog.id == log_id)
    )
    log = result.scalar_one_or_none()
    
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit log not found")
    
    return AuditLogResponse(
        id=log.id,
        action=log.action,
        module=log.module,
        resource_type=log.resource_type,
        resource_id=log.resource_id,
        user_id=log.user_id,
        ip_address=log.ip_address,
        user_agent=log.user_agent,
        details=log.details,
        created_at=log.created_at,
        user_email=log.user.email if log.user else None,
    )

