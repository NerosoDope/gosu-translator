"""
Module: rbac.dependencies - FastAPI dependencies cho RBAC

Module này cung cấp FastAPI dependencies để kiểm tra permissions.

Mục đích:
    - Yêu cầu permissions cụ thể cho endpoints
    - Tích hợp với get_current_user cho authentication

Ngữ cảnh:
    - Được sử dụng bởi tất cả protected endpoints cần permissions
    - Tích hợp với get_current_user để xác thực user

Được sử dụng bởi:
    - Tất cả API endpoints cần permission checks
    - RBAC router cho role/permission management

Xem thêm:
    - app/modules/users/dependencies.py cho get_current_user
    - docs/rbac.md cho permission format
"""

from typing import List, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.modules.rbac.service import RBACService
from app.modules.users.models import User
from app.modules.users.dependencies import get_current_user


async def get_rbac_service(db: AsyncSession = Depends(get_db)) -> RBACService:
    """
    Get RBAC Service - Dependency để lấy RBACService instance
    
    Function này được sử dụng như FastAPI dependency để inject RBACService vào endpoints.
    """
    return RBACService(db)


def require_permission(permission_code: str, organization_id: Optional[int] = None):
    """
    Require Permission - Dependency để yêu cầu permission cụ thể
    
    Function này tạo một dependency function để kiểm tra user có permission cụ thể không.
    Nếu không có permission, raise HTTPException 403.
    
    Quy trình:
    1. Lấy current user từ JWT token (via get_current_user)
    2. Lấy RBAC service instance
    3. Kiểm tra user có required permission không
    4. Nếu có: return current_user
    5. Nếu không: raise HTTPException 403
    
    Args:
        permission_code (str): Permission code cần kiểm tra (format: "module:resource:action")
        organization_id (Optional[int]): Organization ID cho multi-tenant (optional)
    
    Returns:
        Dependency function trả về User nếu permission được granted
    
    Raises:
        HTTPException: 403 Forbidden nếu user không có permission
    
    Example:
        @router.get("/users")
        async def get_users(
            current_user: User = Depends(require_permission("users:read"))
        ):
            return users
    
    Lưu ý:
        - Permission format: "module:resource:action" (ví dụ: "users:read", "rbac:roles:write")
        - User phải đã authenticated (có valid JWT token)
        - Permission được check qua RBACService
    """
    async def permission_checker(
        current_user: User = Depends(get_current_user),
        rbac: RBACService = Depends(get_rbac_service)
    ):
        has_perm = await rbac.has_permission(current_user.id, permission_code, organization_id)
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {permission_code}"
            )
        return current_user
    
    return permission_checker


def require_any_permission(permission_codes: List[str], organization_id: Optional[int] = None):
    """
    Require Any Permission - Dependency để yêu cầu bất kỳ permission nào trong danh sách
    
    Function này tạo một dependency function để kiểm tra user có bất kỳ permission nào
    trong danh sách không. Nếu không có permission nào, raise HTTPException 403.
    
    Args:
        permission_codes (List[str]): Danh sách permission codes cần kiểm tra
        organization_id (Optional[int]): Organization ID cho multi-tenant (optional)
    
    Returns:
        Dependency function trả về User nếu bất kỳ permission nào được granted
    
    Example:
        @router.get("/dashboard")
        async def get_dashboard(
            current_user: User = Depends(require_any_permission(["dashboard:read", "admin:all"]))
        ):
            return dashboard_data
    """
    async def permission_checker(
        current_user: User = Depends(get_current_user),
        rbac: RBACService = Depends(get_rbac_service)
    ):
        has_perm = await rbac.has_any_permission(current_user.id, permission_codes, organization_id)
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of these permissions required: {', '.join(permission_codes)}"
            )
        return current_user
    
    return permission_checker

