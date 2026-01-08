"""
Script để tự động seed permissions và gán cho ADMIN role

Script này sẽ:
1. Tạo tất cả permissions cần thiết cho hệ thống
2. Tự động gán tất cả permissions cho ADMIN role

Usage:
    docker-compose exec backend python /app/scripts/seed_permissions.py
"""

import asyncio
import sys
from pathlib import Path

# Add app directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.modules.rbac.models import Permission, Role
from urllib.parse import urlparse, quote_plus

# Định nghĩa tất cả permissions cần thiết cho hệ thống
DEFAULT_PERMISSIONS = [
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


async def seed_permissions():
    """Tạo tất cả permissions và tự động gán cho ADMIN role"""
    # Convert DATABASE_URL để sử dụng asyncpg driver
    db_url = settings.DATABASE_URL
    if not db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
        db_url = db_url.replace("postgresql+psycopg://", "postgresql+asyncpg://")
        db_url = db_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://")
    
    # URL encode password nếu có special characters
    parsed = urlparse(db_url)
    if parsed.password:
        encoded_password = quote_plus(parsed.password)
        db_url = f"{parsed.scheme}://{parsed.username}:{encoded_password}@{parsed.hostname}:{parsed.port or 5432}{parsed.path}"
    
    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        try:
            print("🚀 Bắt đầu seed permissions...\n")
            
            # Tìm ADMIN role
            result = await db.execute(
                select(Role)
                .options(selectinload(Role.permissions))
                .where(Role.code == "ADMIN")
            )
            admin_role = result.scalar_one_or_none()
            
            if not admin_role:
                print("❌ Không tìm thấy ADMIN role. Vui lòng chạy setup.py để tạo ADMIN role trước.")
                return False
            
            print(f"✅ Tìm thấy ADMIN role (ID: {admin_role.id}, Code: {admin_role.code})\n")
            
            created_count = 0
            existing_count = 0
            all_permissions = []
            
            # Tạo từng permission
            print("📝 Đang tạo permissions...")
            for perm_data in DEFAULT_PERMISSIONS:
                # Kiểm tra permission đã tồn tại chưa
                result = await db.execute(
                    select(Permission).where(Permission.code == perm_data["code"])
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    print(f"  ⏭️  Permission đã tồn tại: {perm_data['code']}")
                    existing_count += 1
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
                    print(f"  ✅ Tạo permission: {perm_data['code']}")
                    created_count += 1
                    all_permissions.append(permission)
            
            await db.flush()
            print(f"\n📊 Đã tạo {created_count} permissions mới, {existing_count} permissions đã tồn tại")
            print(f"📊 Tổng số permissions: {len(all_permissions)}\n")
            
            # Gán tất cả permissions cho ADMIN role
            print("🔗 Đang gán permissions cho ADMIN role...")
            
            # Lấy danh sách permissions hiện tại của ADMIN role
            current_permission_ids = {p.id for p in admin_role.permissions} if admin_role.permissions else set()
            new_permission_ids = {p.id for p in all_permissions}
            
            # Tìm permissions cần thêm (chưa có trong role)
            permissions_to_add = [p for p in all_permissions if p.id not in current_permission_ids]
            
            if permissions_to_add:
                # Thêm permissions vào role
                if admin_role.permissions:
                    admin_role.permissions.extend(permissions_to_add)
                else:
                    admin_role.permissions = permissions_to_add
                
                await db.flush()
                print(f"  ✅ Đã gán {len(permissions_to_add)} permissions mới cho ADMIN role")
            else:
                print(f"  ℹ️  ADMIN role đã có tất cả {len(all_permissions)} permissions")
            
            # Refresh để lấy danh sách permissions đầy đủ
            await db.refresh(admin_role, ["permissions"])
            total_permissions = len(admin_role.permissions) if admin_role.permissions else 0
            
            await db.commit()
            
            print(f"\n✅ Hoàn thành!")
            print(f"📊 ADMIN role hiện có {total_permissions} permissions")
            
            return True
            
        except Exception as e:
            print(f"\n❌ Lỗi khi seed permissions: {e}")
            import traceback
            traceback.print_exc()
            await db.rollback()
            return False
        finally:
            await engine.dispose()


if __name__ == "__main__":
    success = asyncio.run(seed_permissions())
    sys.exit(0 if success else 1)

