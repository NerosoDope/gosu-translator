"""
Module: startup - Startup tasks cho application

Module này chứa các tasks chạy khi application khởi động.

Mục đích:
    - Tự động seed permissions và gán cho ADMIN role
    - Chạy các initialization tasks khác

Author: GOSU Development Team
Version: 1.0.0
"""

from typing import List, Dict, Any

import asyncio
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import AsyncSessionLocal
from app.modules.rbac.models import Permission, Role

logger = logging.getLogger(__name__)

# Định nghĩa tất cả permissions cần thiết cho hệ thống
DEFAULT_PERMISSIONS: List[Dict[str, Any]] = [
    # User management
    {"code": "users:read", "name": "Read Users", "module": "users", "resource": "users", "action": "read", "description": "Permission to read users"},
    {"code": "users:write", "name": "Write Users", "module": "users", "resource": "users", "action": "write", "description": "Permission to create and update users"},
    {"code": "users:delete", "name": "Delete Users", "module": "users", "resource": "users", "action": "delete", "description": "Permission to delete users"},
    
    # RBAC management
    {"code": "rbac:roles:read", "name": "Read Roles", "module": "rbac", "resource": "roles", "action": "read", "description": "Permission to read roles"},
    {"code": "rbac:roles:write", "name": "Write Roles", "module": "rbac", "resource": "roles", "action": "write", "description": "Permission to create and update roles"},
    {"code": "rbac:roles:delete", "name": "Delete Roles", "module": "rbac", "resource": "roles", "action": "delete", "description": "Permission to delete roles"},
    {"code": "rbac:permissions:read", "name": "Read Permissions", "module": "rbac", "resource": "permissions", "action": "read", "description": "Permission to read permissions"},
    {"code": "rbac:permissions:write", "name": "Write Permissions", "module": "rbac", "resource": "permissions", "action": "write", "description": "Permission to create and update permissions"},
    {"code": "rbac:permissions:delete", "name": "Delete Permissions", "module": "rbac", "resource": "permissions", "action": "delete", "description": "Permission to delete permissions"},
    {"code": "rbac:user_roles:read", "name": "Read User Roles", "module": "rbac", "resource": "user_roles", "action": "read", "description": "Permission to read user role assignments"},
    {"code": "rbac:user_roles:write", "name": "Write User Roles", "module": "rbac", "resource": "user_roles", "action": "write", "description": "Permission to assign and revoke user roles"},
    
    # Dashboard
    {"code": "dashboard:read", "name": "Read Dashboard", "module": "dashboard", "resource": "dashboard", "action": "read", "description": "Permission to view dashboard"},
    
    # Settings
    {"code": "settings:read", "name": "Read Settings", "module": "settings", "resource": "settings", "action": "read", "description": "Permission to read settings"},
    {"code": "settings:write", "name": "Write Settings", "module": "settings", "resource": "settings", "action": "write", "description": "Permission to create and update settings"},
    {"code": "settings:delete", "name": "Delete Settings", "module": "settings", "resource": "settings", "action": "delete", "description": "Permission to delete settings"},
    
    # Audit Log
    {"code": "audit:read", "name": "Read Audit Logs", "module": "audit", "resource": "audit", "action": "read", "description": "Permission to read audit logs"},
]


async def seed_permissions_on_startup():
    """
    Tự động seed permissions và gán cho ADMIN role khi application khởi động
    
    Chỉ chạy nếu ADMIN role tồn tại và chưa có đủ permissions.
    """
    try:
        async with AsyncSessionLocal() as db:
            # Tìm ADMIN role
            result = await db.execute(
                select(Role)
                .options(selectinload(Role.permissions))
                .where(Role.code == "ADMIN")
            )
            admin_role = result.scalar_one_or_none()
            
            if not admin_role:
                logger.info("ADMIN role chưa tồn tại, bỏ qua seed permissions")
                return
            
            created_count = 0
            all_permissions = []
            
            # Tạo từng permission nếu chưa tồn tại
            for perm_data in DEFAULT_PERMISSIONS:
                result = await db.execute(
                    select(Permission).where(Permission.code == perm_data["code"])
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    all_permissions.append(existing)
                else:
                    permission = Permission(
                        code=perm_data["code"],
                        name=perm_data["name"],
                        description=perm_data.get("description", ""),
                        module=perm_data["module"],
                        resource=perm_data["resource"],
                        action=perm_data["action"],
                        is_active=True
                    )
                    db.add(permission)
                    await db.flush()
                    await db.refresh(permission)
                    all_permissions.append(permission)
                    created_count += 1
            
            await db.flush()
            
            if created_count > 0:
                logger.info(f"Created {created_count} new permissions on startup")
            
            # Gán tất cả permissions cho ADMIN role
            current_permission_ids = {p.id for p in admin_role.permissions} if admin_role.permissions else set()
            new_permission_ids = {p.id for p in all_permissions}
            
            permissions_to_add = [p for p in all_permissions if p.id not in current_permission_ids]
            
            if permissions_to_add:
                if admin_role.permissions:
                    admin_role.permissions.extend(permissions_to_add)
                else:
                    admin_role.permissions = permissions_to_add
                
                await db.flush()
                logger.info(f"Assigned {len(permissions_to_add)} new permissions to ADMIN role")
            
            await db.commit()
            
    except Exception as e:
        logger.error(f"Error seeding permissions on startup: {e}", exc_info=True)
        # Không raise exception để không block application startup

