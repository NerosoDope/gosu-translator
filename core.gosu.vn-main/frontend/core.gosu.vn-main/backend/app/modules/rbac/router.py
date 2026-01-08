"""
Module: rbac.router - Router quản lý RBAC

Module này cung cấp các API endpoints cho RBAC management.

Mục đích:
    - Expose RBAC management APIs (roles, permissions, assignments)
    - Cung cấp CRUD operations cho roles và permissions
    - Quản lý role-to-user assignments

Ngữ cảnh:
    - RBAC là core security mechanism
    - System roles (is_system=True) không thể bị xóa/sửa
    - Permission format: {module}:{resource}:{action}

Được sử dụng bởi:
    - Admin UI cho role/permission management
    - Automated role assignment scripts
    - Permission seeding migrations

Xem thêm:
    - docs/rbac.md cho RBAC usage guide
    - app/modules/rbac/service.py cho business logic
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
import logging
from app.db.session import get_db
from app.modules.users.models import User
from app.modules.users.dependencies import get_current_user
from app.modules.rbac.dependencies import require_permission, get_rbac_service
from app.modules.rbac.service import RBACService
from app.modules.rbac.schemas import (
    RoleCreate, RoleUpdate, RoleResponse, RoleWithPermissions,
    PermissionCreate, PermissionUpdate, PermissionResponse,
    UserRoleCreate, UserRoleResponse
)
from app.modules.rbac.models import Role, Permission, UserRole
from app.modules.audit.service import AuditService
from app.core.startup import DEFAULT_PERMISSIONS

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/roles", response_model=List[RoleResponse])
async def get_roles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("rbac:roles:read"))
):
    """
    Get Roles - Lấy danh sách roles
    
    Endpoint này trả về danh sách roles với pagination và filter.
    Yêu cầu permission "rbac:roles:read" để truy cập.
    """
    # Load roles với permissions để đếm số lượng
    query = select(Role).options(selectinload(Role.permissions))
    if is_active is not None:
        query = query.where(Role.is_active == is_active)
    query = query.order_by(Role.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    roles = result.scalars().all()
    
    # Set permissions_count cho mỗi role
    for role in roles:
        role.permissions_count = len(role.permissions) if role.permissions else 0
    
    return roles


@router.get("/roles/{role_id}", response_model=RoleWithPermissions)
async def get_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("rbac:roles:read"))
):
    """
    Get Role - Lấy chi tiết role kèm permissions
    
    Endpoint này trả về thông tin chi tiết của role kèm danh sách permissions.
    Yêu cầu permission "rbac:roles:read" để truy cập.
    """
    result = await db.execute(
        select(Role)
        .options(selectinload(Role.permissions))
        .where(Role.id == role_id)
    )
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    
    return role


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    request: Request,
    role_data: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("rbac:roles:write"))
):
    """
    Create Role - Tạo role mới
    
    Endpoint này tạo một role mới trong hệ thống RBAC.
    Yêu cầu permission "rbac:roles:write" để truy cập.
    """
    # Check if code already exists
    result = await db.execute(select(Role).where(Role.code == role_data.code))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role with code '{role_data.code}' already exists"
        )
    
    role = Role(**role_data.model_dump())
    db.add(role)
    await db.commit()
    await db.refresh(role)
    
    # Log audit
    audit_service = AuditService(db)
    await audit_service.log(
        action="create",
        module="rbac",
        user_id=current_user.id,
        resource_type="Role",
        resource_id=role.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"code": role.code, "name": role.name, "is_system": role.is_system}
    )
    await db.commit()
    
    return role


@router.put("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    request: Request,
    role_id: int,
    role_data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("rbac:roles:write"))
):
    """
    Update Role - Cập nhật role
    
    Endpoint này cập nhật thông tin của role.
    Yêu cầu permission "rbac:roles:write" để truy cập.
    System roles (is_system=True) không thể cập nhật.
    """
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update system role"
        )
    
    # Store old values for audit log
    old_values = {key: getattr(role, key) for key in role_data.model_dump(exclude_unset=True).keys()}
    
    for key, value in role_data.model_dump(exclude_unset=True).items():
        setattr(role, key, value)
    
    await db.commit()
    await db.refresh(role)
    
    # Log audit
    audit_service = AuditService(db)
    await audit_service.log(
        action="update",
        module="rbac",
        user_id=current_user.id,
        resource_type="Role",
        resource_id=role.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"code": role.code, "old_values": old_values, "new_values": role_data.model_dump(exclude_unset=True)}
    )
    await db.commit()
    
    return role


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    request: Request,
    role_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("rbac:roles:delete"))
):
    """
    Delete Role - Xóa role
    
    Endpoint này xóa role khỏi hệ thống.
    Yêu cầu permission "rbac:roles:delete" để truy cập.
    System roles (is_system=True) không thể xóa.
    """
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete system role"
        )
    
    # Store role info for audit log before deletion
    role_code = role.code
    role_name = role.name
    
    await db.delete(role)
    await db.commit()
    
    # Log audit
    audit_service = AuditService(db)
    await audit_service.log(
        action="delete",
        module="rbac",
        user_id=current_user.id,
        resource_type="Role",
        resource_id=role_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"code": role_code, "name": role_name}
    )
    await db.commit()
    
    return None


@router.get("/permissions", response_model=List[PermissionResponse])
async def get_permissions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    is_active: Optional[bool] = None,
    module: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("rbac:permissions:read"))
):
    """
    Get Permissions - Lấy danh sách permissions
    
    Endpoint này trả về danh sách permissions với pagination và filter.
    Yêu cầu permission "rbac:permissions:read" để truy cập.
    """
    query = select(Permission)
    if is_active is not None:
        query = query.where(Permission.is_active == is_active)
    if module:
        query = query.where(Permission.module == module)
    query = query.order_by(Permission.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    permissions = result.scalars().all()
    return permissions


@router.post("/permissions", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
async def create_permission(
    request: Request,
    permission_data: PermissionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("rbac:permissions:write"))
):
    """
    Create Permission - Tạo permission mới
    
    Endpoint này tạo một permission mới trong hệ thống RBAC.
    Yêu cầu permission "rbac:permissions:write" để truy cập.
    """
    # Check if code already exists
    result = await db.execute(select(Permission).where(Permission.code == permission_data.code))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Permission with code '{permission_data.code}' already exists"
        )
    
    permission = Permission(**permission_data.model_dump())
    db.add(permission)
    await db.commit()
    await db.refresh(permission)
    
    # Log audit
    audit_service = AuditService(db)
    await audit_service.log(
        action="create",
        module="rbac",
        user_id=current_user.id,
        resource_type="Permission",
        resource_id=permission.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"code": permission.code, "name": permission.name, "module": permission.module}
    )
    await db.commit()
    
    return permission


@router.get("/permissions/{permission_id}", response_model=PermissionResponse)
async def get_permission(
    permission_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("rbac:permissions:read"))
):
    """
    Get Permission - Lấy thông tin permission theo ID
    
    Endpoint này trả về thông tin chi tiết của permission.
    Yêu cầu permission "rbac:permissions:read" để truy cập.
    """
    result = await db.execute(select(Permission).where(Permission.id == permission_id))
    permission = result.scalar_one_or_none()
    
    if not permission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    
    return permission


@router.put("/permissions/{permission_id}", response_model=PermissionResponse)
async def update_permission(
    request: Request,
    permission_id: int,
    permission_data: PermissionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("rbac:permissions:write"))
):
    """
    Update Permission - Cập nhật permission
    
    Endpoint này cập nhật thông tin của permission.
    Yêu cầu permission "rbac:permissions:write" để truy cập.
    """
    result = await db.execute(select(Permission).where(Permission.id == permission_id))
    permission = result.scalar_one_or_none()
    
    if not permission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    
    # Store old values for audit log
    old_values = {field: getattr(permission, field) for field in permission_data.model_dump(exclude_unset=True).keys()}
    
    # Update fields
    update_data = permission_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(permission, field, value)
    
    await db.commit()
    await db.refresh(permission)
    
    # Log audit
    audit_service = AuditService(db)
    await audit_service.log(
        action="update",
        module="rbac",
        user_id=current_user.id,
        resource_type="Permission",
        resource_id=permission.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"code": permission.code, "old_values": old_values, "new_values": update_data}
    )
    await db.commit()
    
    return permission


@router.delete("/permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_permission(
    request: Request,
    permission_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("rbac:permissions:delete"))
):
    """
    Delete Permission - Xóa permission
    
    Endpoint này xóa permission khỏi hệ thống.
    Yêu cầu permission "rbac:permissions:delete" để truy cập.
    
    Lưu ý: Permission sẽ bị xóa khỏi tất cả roles đã được gán.
    """
    result = await db.execute(select(Permission).where(Permission.id == permission_id))
    permission = result.scalar_one_or_none()
    
    if not permission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    
    # Store permission info for audit log before deletion
    permission_code = permission.code
    permission_name = permission.name
    
    await db.delete(permission)
    await db.commit()
    
    # Log audit
    audit_service = AuditService(db)
    await audit_service.log(
        action="delete",
        module="rbac",
        user_id=current_user.id,
        resource_type="Permission",
        resource_id=permission_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"code": permission_code, "name": permission_name}
    )
    await db.commit()
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/roles/{role_id}/permissions")
async def assign_permissions_to_role(
    request: Request,
    role_id: int,
    permission_ids: List[int] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("rbac:roles:write"))
):
    """
    Assign Permissions to Role - Gán permissions cho role
    
    Endpoint này gán danh sách permissions cho role.
    Yêu cầu permission "rbac:roles:write" để truy cập.
    """
    # Load role với permissions để tránh MissingGreenlet error
    result = await db.execute(
        select(Role)
        .options(selectinload(Role.permissions))
        .where(Role.id == role_id)
    )
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify permissions of system role"
        )
    
    # Get permissions
    result = await db.execute(select(Permission).where(Permission.id.in_(permission_ids)))
    permissions = result.scalars().all()
    
    if len(permissions) != len(permission_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Some permissions not found"
        )
    
    # Store old permission IDs for audit log
    old_permission_ids = [p.id for p in role.permissions] if role.permissions else []
    
    # Assign permissions (SQLAlchemy sẽ tự động update many-to-many table)
    role.permissions = permissions
    await db.commit()
    await db.refresh(role, ["permissions"])
    
    # Log audit
    audit_service = AuditService(db)
    await audit_service.log(
        action="assign_permissions",
        module="rbac",
        user_id=current_user.id,
        resource_type="Role",
        resource_id=role.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "role_code": role.code,
            "old_permission_ids": old_permission_ids,
            "new_permission_ids": permission_ids
        }
    )
    await db.commit()
    
    return {"message": "Permissions assigned successfully", "role_id": role_id, "permission_ids": permission_ids}


@router.get("/roles/{role_id}/permissions", response_model=List[PermissionResponse])
async def get_role_permissions(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("rbac:roles:read"))
):
    """
    Get Role Permissions - Lấy danh sách permissions của role
    
    Endpoint này trả về danh sách permissions đã được gán cho role.
    Yêu cầu permission "rbac:roles:read" để truy cập.
    """
    result = await db.execute(
        select(Role)
        .options(selectinload(Role.permissions))
        .where(Role.id == role_id)
    )
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    
    return role.permissions if role.permissions else []


@router.post("/user-roles/assign", response_model=UserRoleResponse, status_code=status.HTTP_201_CREATED)
async def assign_role_to_user(
    request: Request,
    user_role_data: UserRoleCreate,
    db: AsyncSession = Depends(get_db),
    rbac: RBACService = Depends(get_rbac_service),
    current_user: User = Depends(require_permission("rbac:user_roles:write"))
):
    """
    Assign Role to User - Gán role cho user
    
    Endpoint này gán một role cho một user.
    Hỗ trợ multi-tenant qua organization_id (optional).
    Yêu cầu permission "rbac:user_roles:write" để truy cập.
    """
    # Check if user exists
    result = await db.execute(select(User).where(User.id == user_role_data.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Check if role exists
    result = await db.execute(select(Role).where(Role.id == user_role_data.role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    
    # Check if already assigned
    query = select(UserRole).where(
        and_(
            UserRole.user_id == user_role_data.user_id,
            UserRole.role_id == user_role_data.role_id
        )
    )
    if user_role_data.organization_id:
        query = query.where(UserRole.organization_id == user_role_data.organization_id)
    
    result = await db.execute(query)
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role already assigned to user"
        )
    
    # Assign role using RBAC service
    user_role = await rbac.assign_role(
        user_id=user_role_data.user_id,
        role_id=user_role_data.role_id,
        organization_id=user_role_data.organization_id,
        assigned_by=current_user.id
    )
    await db.commit()
    await db.refresh(user_role)
    
    # Log audit
    audit_service = AuditService(db)
    await audit_service.log(
        action="assign_role",
        module="rbac",
        user_id=current_user.id,
        resource_type="UserRole",
        resource_id=user_role.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "user_id": user_role_data.user_id,
            "role_id": user_role_data.role_id,
            "role_code": role.code,
            "organization_id": user_role_data.organization_id
        }
    )
    await db.commit()
    
    return user_role


@router.delete("/user-roles/revoke", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_role_from_user(
    request: Request,
    user_id: int,
    role_id: int,
    organization_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    rbac: RBACService = Depends(get_rbac_service),
    current_user: User = Depends(require_permission("rbac:user_roles:write"))
):
    """
    Revoke Role from User - Thu hồi role của user
    
    Endpoint này thu hồi role đã được gán cho user.
    Yêu cầu permission "rbac:user_roles:write" để truy cập.
    """
    # Get role info for audit log
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    role_code = role.code if role else None
    
    # Get user role info before revoking
    query = select(UserRole).where(
        and_(
            UserRole.user_id == user_id,
            UserRole.role_id == role_id
        )
    )
    if organization_id:
        query = query.where(UserRole.organization_id == organization_id)
    result = await db.execute(query)
    user_role = result.scalar_one_or_none()
    
    success = await rbac.revoke_role(
        user_id=user_id,
        role_id=role_id,
        organization_id=organization_id
    )
    
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User role not found")
    
    await db.commit()
    
    # Log audit
    if user_role:
        audit_service = AuditService(db)
        await audit_service.log(
            action="revoke_role",
            module="rbac",
            user_id=current_user.id,
            resource_type="UserRole",
            resource_id=user_role.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            details={
                "user_id": user_id,
                "role_id": role_id,
                "role_code": role_code,
                "organization_id": organization_id
            }
        )
        await db.commit()
    
    return None


@router.get("/user-roles/user/{user_id}", response_model=List[UserRoleResponse])
async def get_user_roles(
    user_id: int,
    organization_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("rbac:user_roles:read"))
):
    """
    Get User Roles - Lấy danh sách roles của user
    
    Endpoint này trả về danh sách roles đã được gán cho user.
    Yêu cầu permission "rbac:user_roles:read" để truy cập.
    """
    # Check if user exists
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    query = select(UserRole).options(selectinload(UserRole.role)).where(UserRole.user_id == user_id)
    if organization_id:
        query = query.where(UserRole.organization_id == organization_id)
    
    result = await db.execute(query.order_by(UserRole.assigned_at.desc()))
    user_roles = result.scalars().all()
    
    return user_roles


@router.post("/permissions/seed")
async def seed_permissions(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("rbac:permissions:write"))
):
    """
    Seed Permissions - Tự động tạo permissions và gán cho ADMIN role
    
    Endpoint này tự động:
    1. Tạo tất cả permissions mặc định nếu chưa tồn tại
    2. Gán tất cả permissions cho ADMIN role
    
    Yêu cầu permission "rbac:permissions:write" để truy cập.
    """
    try:
        # Tìm ADMIN role
        result = await db.execute(
            select(Role)
            .options(selectinload(Role.permissions))
            .where(Role.code == "ADMIN")
        )
        admin_role = result.scalar_one_or_none()
        
        if not admin_role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ADMIN role not found. Please run setup.py first."
            )
        
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
        
        await db.commit()
        
        # Log audit
        audit_service = AuditService(db)
        await audit_service.log(
            action="seed_permissions",
            module="rbac",
            user_id=current_user.id,
            resource_type="Permission",
            resource_id=None,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            details={
                "created_count": created_count,
                "assigned_count": len(permissions_to_add),
                "total_permissions": len(all_permissions)
            }
        )
        await db.commit()
        
        return {
            "message": "Permissions seeded successfully",
            "created_permissions": created_count,
            "assigned_to_admin": len(permissions_to_add),
            "total_permissions": len(all_permissions)
        }
        
    except Exception as e:
        logger.error(f"Error seeding permissions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to seed permissions: {str(e)}"
        )
