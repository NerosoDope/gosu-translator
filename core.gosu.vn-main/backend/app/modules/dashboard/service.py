"""
Module: dashboard.service - Service cho dashboard metrics

Module này cung cấp business logic để tính toán metrics và statistics cho dashboard.

Mục đích:
    - Aggregate data từ các modules (users, roles, permissions)
    - Tính toán statistics (tổng số, active/inactive, etc.)
    - Cung cấp data cho dashboard UI

Ngữ cảnh:
    - Dashboard hiển thị overview của hệ thống
    - Metrics được tính real-time từ database
    - Có thể cache metrics để tối ưu performance (future)

Được sử dụng bởi:
    - Dashboard router để expose API endpoints
    - Frontend dashboard components

Xem thêm:
    - app/modules/dashboard/router.py cho API endpoints
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from typing import Dict, Any
from app.modules.users.models import User
from app.modules.rbac.models import Role, Permission, UserRole


class DashboardService:
    """Service để tính toán dashboard metrics"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_metrics(self) -> Dict[str, Any]:
        """
        Get Dashboard Metrics - Lấy tất cả metrics cho dashboard
        
        Tối ưu hóa: Sử dụng CASE WHEN để giảm số lượng queries từ 10 xuống còn 4 queries.
        
        Returns:
            Dict chứa các metrics:
            - users: Tổng số users, active users, inactive users
            - roles: Tổng số roles, system roles, custom roles
            - permissions: Tổng số permissions, active permissions
            - user_roles: Tổng số user-role assignments
        """
        # Tối ưu: Users metrics - 1 query thay vì 3 queries
        users_result = await self.db.execute(
            select(
                func.count(User.id).label("total"),
                func.sum(case((User.is_active == True, 1), else_=0)).label("active"),
                func.sum(case((User.is_active == False, 1), else_=0)).label("inactive")
            )
        )
        users_row = users_result.first()
        
        # Tối ưu: Roles metrics - 1 query thay vì 4 queries
        roles_result = await self.db.execute(
            select(
                func.count(Role.id).label("total"),
                func.sum(case((Role.is_system == True, 1), else_=0)).label("system"),
                func.sum(case((Role.is_system == False, 1), else_=0)).label("custom"),
                func.sum(case((Role.is_active == True, 1), else_=0)).label("active")
            )
        )
        roles_row = roles_result.first()
        
        # Tối ưu: Permissions metrics - 1 query thay vì 2 queries
        permissions_result = await self.db.execute(
            select(
                func.count(Permission.id).label("total"),
                func.sum(case((Permission.is_active == True, 1), else_=0)).label("active")
            )
        )
        permissions_row = permissions_result.first()
        
        # User-Role assignments metrics
        user_roles_total = await self.db.scalar(select(func.count(UserRole.id))) or 0
        
        return {
            "users": {
                "total": users_row.total or 0,
                "active": users_row.active or 0,
                "inactive": users_row.inactive or 0,
            },
            "roles": {
                "total": roles_row.total or 0,
                "system": roles_row.system or 0,
                "custom": roles_row.custom or 0,
                "active": roles_row.active or 0,
            },
            "permissions": {
                "total": permissions_row.total or 0,
                "active": permissions_row.active or 0,
            },
            "user_role_assignments": {
                "total": user_roles_total,
            }
        }

