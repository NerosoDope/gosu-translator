"""
Module: rbac.service - Service quản lý RBAC

Module này cung cấp policy engine cho Role-Based Access Control.

Mục đích:
    - Kiểm tra user permissions dựa trên roles
    - Quản lý role assignments cho users
    - Hỗ trợ multi-tenant qua organization_id

Ngữ cảnh:
    - Permissions được kế thừa từ roles
    - User có thể có nhiều roles (union của permissions)
    - Hỗ trợ multi-tenant qua organization_id
    - Permissions có thể được cache để tăng performance

Được sử dụng bởi:
    - RBAC dependencies (require_permission, etc.)
    - API endpoints cho authorization checks
    - Business logic cần validate permissions

Xem thêm:
    - docs/rbac.md cho permission resolution strategy
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.modules.rbac.models import Role, Permission, UserRole


class RBACService:
    """
    RBAC Service - Policy engine cho role-based access control.

    Trách nhiệm:
    - Resolve user permissions từ assigned roles
    - Kiểm tra user có permission cụ thể không
    - Quản lý role assignments cho users
    - Hỗ trợ multi-tenant permission isolation

    Lưu ý:
    - Permissions là union của tất cả role permissions (không phải intersection)
    - Chỉ active permissions được xem xét
    - Organization ID cho phép cùng một user có roles khác nhau theo org
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_user_roles(self, user_id: int, organization_id: Optional[int] = None) -> List[Role]:
        """Get User Roles - Lấy tất cả roles của user"""
        query = select(Role).join(UserRole).where(UserRole.user_id == user_id)
        if organization_id:
            query = query.where(UserRole.organization_id == organization_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def get_user_permissions(self, user_id: int, organization_id: Optional[int] = None) -> List[Permission]:
        """
        Lấy tất cả permissions của user (union của tất cả role permissions).

        Quy trình:
        1. Lấy tất cả roles được gán cho user (có thể filter theo org)
        2. Thu thập tất cả permissions từ các roles này
        3. Chỉ lọc active permissions
        4. Trả về unique permissions (loại bỏ duplicate)

        Lý do sử dụng union (không phải intersection):
        - User với nhiều roles nhận tất cả permissions từ tất cả roles
        - Cách tiếp cận permissive hơn (dễ cấp quyền hơn)
        - Có thể hạn chế qua explicit deny permissions nếu cần

        Performance:
        - Nên cache kết quả trong Redis cho users được truy cập thường xuyên
        - Cache TTL nên ngắn để phản ánh thay đổi permissions nhanh chóng
        """
        roles = await self.get_user_roles(user_id, organization_id)
        if not roles:
            return []
        
        role_ids = [role.id for role in roles]
        result = await self.db.execute(
            select(Permission)
            .join(Role.permissions)
            .where(Role.id.in_(role_ids))
            .where(Permission.is_active == True)
        )
        return list(result.scalars().unique().all())
    
    async def has_permission(self, user_id: int, permission_code: str, organization_id: Optional[int] = None) -> bool:
        """Has Permission - Kiểm tra user có permission cụ thể không"""
        permissions = await self.get_user_permissions(user_id, organization_id)
        permission_codes = [p.code for p in permissions]
        return permission_code in permission_codes
    
    async def has_any_permission(self, user_id: int, permission_codes: List[str], organization_id: Optional[int] = None) -> bool:
        """Kiểm tra user có bất kỳ permission nào trong danh sách không"""
        permissions = await self.get_user_permissions(user_id, organization_id)
        user_permission_codes = [p.code for p in permissions]
        return any(code in user_permission_codes for code in permission_codes)
    
    async def has_module_access(self, user_id: int, module: str, organization_id: Optional[int] = None) -> bool:
        """Kiểm tra user có quyền truy cập module không"""
        permissions = await self.get_user_permissions(user_id, organization_id)
        return any(p.module == module and p.is_active for p in permissions)
    
    async def assign_role(self, user_id: int, role_id: int, organization_id: Optional[int] = None, assigned_by: Optional[int] = None) -> UserRole:
        """Assign Role - Gán role cho user"""
        user_role = UserRole(
            user_id=user_id,
            role_id=role_id,
            organization_id=organization_id,
            assigned_by=assigned_by
        )
        self.db.add(user_role)
        await self.db.flush()
        return user_role
    
    async def revoke_role(self, user_id: int, role_id: int, organization_id: Optional[int] = None) -> bool:
        """Thu hồi role của user"""
        query = select(UserRole).where(
            and_(
                UserRole.user_id == user_id,
                UserRole.role_id == role_id
            )
        )
        if organization_id:
            query = query.where(UserRole.organization_id == organization_id)
        
        result = await self.db.execute(query)
        user_role = result.scalar_one_or_none()
        if user_role:
            await self.db.delete(user_role)
            await self.db.flush()
            return True
        return False

