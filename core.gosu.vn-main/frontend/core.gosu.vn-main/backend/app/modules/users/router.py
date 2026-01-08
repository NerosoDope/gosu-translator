"""
Module: users.router - Router quản lý users

Module này cung cấp các API endpoints cho user management.

Mục đích:
    - Expose user management APIs (CRUD operations)
    - Xử lý user sync từ apis.gosu.vn

Ngữ cảnh:
    - Users được sync từ external GOSU API sau khi login
    - Tất cả endpoints yêu cầu authentication và permissions
    - Soft delete được sử dụng (set is_active=False)

Được sử dụng bởi:
    - Admin UI cho user management
    - Auth module cho user sync

Xem thêm:
    - app/modules/users/models.py cho User model
    - app/modules/users/schemas.py cho request/response models
    - docs/architecture.md cho user sync flow
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from typing import Optional
from math import ceil
from app.db.session import get_db
from app.modules.users.models import User
from app.modules.users.schemas import UserCreate, UserUpdate, UserResponse, UserListResponse
from app.modules.users.dependencies import get_current_user
from app.modules.rbac.dependencies import require_permission
from app.modules.audit.service import AuditService
from app.core.security import hash_password

router = APIRouter()


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users:read"))
):
    """
    Get User by ID - Lấy thông tin user theo ID
    
    Endpoint này trả về thông tin của user theo ID.
    Yêu cầu permission "users:read" để truy cập.
    
    Args:
        user_id (int): User ID cần lấy thông tin
        db (AsyncSession): Database session
        current_user (User): Current authenticated user (from permission check)
    
    Returns:
        UserResponse: Thông tin đầy đủ của user
    
    Raises:
        HTTPException: 404 nếu user không tồn tại
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


@router.get("", response_model=UserListResponse)
async def get_users(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by email or full_name"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users:read"))
):
    """
    Get Users List - Lấy danh sách users với pagination và filter
    
    Endpoint này trả về danh sách users với các tùy chọn filter và pagination.
    Yêu cầu permission "users:read" để truy cập.
    
    Args:
        page (int): Số trang (default: 1, min: 1)
        per_page (int): Số items mỗi trang (default: 10, min: 1, max: 100)
        search (Optional[str]): Tìm kiếm theo email hoặc full_name
        is_active (Optional[bool]): Lọc theo trạng thái active
        db (AsyncSession): Database session
        current_user (User): Current authenticated user
    
    Returns:
        UserListResponse: Danh sách users với pagination info
    """
    # Build query
    query = select(User)
    count_query = select(func.count()).select_from(User)
    
    # Apply filters
    conditions = []
    if search:
        search_pattern = f"%{search}%"
        conditions.append(
            or_(
                User.email.ilike(search_pattern),
                User.full_name.ilike(search_pattern)
            )
        )
    if is_active is not None:
        conditions.append(User.is_active == is_active)
    
    if conditions:
        query = query.where(*conditions)
        count_query = count_query.where(*conditions)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    skip = (page - 1) * per_page
    query = query.order_by(User.created_at.desc()).offset(skip).limit(per_page)
    
    # Execute query
    result = await db.execute(query)
    users = result.scalars().all()
    
    # Calculate pages
    pages = ceil(total / per_page) if total > 0 else 0
    
    return UserListResponse(
        items=users,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    request: Request,
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users:write"))
):
    """
    Create User - Tạo user mới
    
    Endpoint này tạo một user mới trong hệ thống.
    Yêu cầu permission "users:write" để truy cập.
    
    Args:
        request (Request): FastAPI request object để lấy IP và user agent
        user_data (UserCreate): Dữ liệu user cần tạo
        db (AsyncSession): Database session
        current_user (User): Current authenticated user
    
    Returns:
        UserResponse: Thông tin user đã tạo
    
    Raises:
        HTTPException: 400 nếu email đã tồn tại
    """
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"User with email '{user_data.email}' already exists"
        )
    
    # Create user
    user_dict = user_data.model_dump(exclude_unset=True)
    
    # Hash password if provided
    if "password" in user_dict and user_dict["password"]:
        user_dict["password"] = hash_password(user_dict["password"])
    
    if "id" not in user_dict or user_dict["id"] is None:
        # If no ID provided, we need to get it from apis.gosu.vn
        # For now, raise error - ID is required
        raise HTTPException(
            status_code=400,
            detail="User ID is required. Users should be synced from apis.gosu.vn via login."
        )
    
    user = User(**user_dict)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Log audit
    audit_service = AuditService(db)
    await audit_service.log(
        action="create",
        module="users",
        user_id=current_user.id,
        resource_type="User",
        resource_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"email": user.email, "full_name": user.full_name}
    )
    await db.commit()
    
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    request: Request,
    user_id: int,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users:write"))
):
    """
    Update User - Cập nhật user
    
    Endpoint này cập nhật thông tin của user.
    Yêu cầu permission "users:write" để truy cập.
    
    Args:
        request (Request): FastAPI request object để lấy IP và user agent
        user_id (int): User ID cần cập nhật
        user_data (UserUpdate): Dữ liệu cập nhật
        db (AsyncSession): Database session
        current_user (User): Current authenticated user
    
    Returns:
        UserResponse: Thông tin user đã cập nhật
    
    Raises:
        HTTPException: 404 nếu user không tồn tại
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Store old values for audit log
    old_values = {field: getattr(user, field) for field in user_data.model_dump(exclude_unset=True).keys()}
    
    # Update fields
    update_data = user_data.model_dump(exclude_unset=True)
    
    # Hash password if provided
    if "password" in update_data and update_data["password"]:
        update_data["password"] = hash_password(update_data["password"])
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    await db.commit()
    await db.refresh(user)
    
    # Log audit
    audit_service = AuditService(db)
    await audit_service.log(
        action="update",
        module="users",
        user_id=current_user.id,
        resource_type="User",
        resource_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"old_values": old_values, "new_values": update_data}
    )
    await db.commit()
    
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    request: Request,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users:delete"))
):
    """
    Delete User - Xóa user (soft delete bằng cách set is_active=False)
    
    Endpoint này xóa user bằng cách set is_active=False (soft delete).
    Yêu cầu permission "users:delete" để truy cập.
    
    Args:
        request (Request): FastAPI request object để lấy IP và user agent
        user_id (int): User ID cần xóa
        db (AsyncSession): Database session
        current_user (User): Current authenticated user
    
    Raises:
        HTTPException: 404 nếu user không tồn tại
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Soft delete
    user.is_active = False
    await db.commit()
    
    # Log audit
    audit_service = AuditService(db)
    await audit_service.log(
        action="delete",
        module="users",
        user_id=current_user.id,
        resource_type="User",
        resource_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"email": user.email, "full_name": user.full_name}
    )
    await db.commit()
    
    return None

