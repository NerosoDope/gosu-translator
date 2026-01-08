"""
Module: settings.router - API Endpoints cho Settings Management

Module này cung cấp các API endpoints để quản lý settings.

Mục đích:
    - Expose API để CRUD settings
    - Get public settings (không cần auth)
    - Bulk update settings

Ngữ cảnh:
    - Được sử dụng bởi frontend để quản lý cấu hình hệ thống
    - Public settings có thể được truy cập không cần auth

Được sử dụng bởi:
    - app/main.py để đăng ký router
    - Frontend settings management components

Xem thêm:
    - app/modules/settings/service.py cho business logic
    - app/modules/settings/models.py cho Setting model

Author: GOSU Development Team
Version: 1.0.0
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.db.session import get_db
from app.modules.users.models import User
from app.modules.users.dependencies import get_current_user
from app.modules.rbac.dependencies import require_permission
from app.modules.settings.service import SettingsService
from app.modules.settings.schemas import (
    SettingCreate, SettingUpdate, SettingResponse,
    SettingValueUpdate, BulkSettingsUpdate
)
from app.modules.settings.models import SettingCategory
from app.modules.audit.service import AuditService

router = APIRouter()


@router.get("", response_model=List[SettingResponse])
async def get_settings(
    category: Optional[SettingCategory] = Query(None, description="Lọc theo category"),
    is_active: Optional[bool] = Query(None, description="Lọc theo trạng thái active"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:read"))
):
    """
    Get Settings - Lấy danh sách settings
    
    Endpoint này trả về danh sách settings với các tùy chọn filter.
    Yêu cầu permission "settings:read" để truy cập.
    """
    service = SettingsService(db)
    settings = await service.get_settings(category=category, is_active=is_active)
    return settings


@router.get("/public", response_model=List[SettingResponse])
async def get_public_settings(
    db: AsyncSession = Depends(get_db)
):
    """
    Get Public Settings - Lấy danh sách public settings
    
    Endpoint này trả về danh sách public settings (is_public=True).
    Không cần authentication để truy cập.
    """
    service = SettingsService(db)
    settings = await service.get_public_settings()
    return settings


@router.get("/{setting_id}", response_model=SettingResponse)
async def get_setting(
    setting_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:read"))
):
    """
    Get Setting by ID - Lấy thông tin setting theo ID
    
    Yêu cầu permission "settings:read" để truy cập.
    """
    service = SettingsService(db)
    setting = await service.get_setting_by_id(setting_id)
    
    if not setting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Setting not found")
    
    return setting


@router.get("/key/{key}", response_model=SettingResponse)
async def get_setting_by_key(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:read"))
):
    """
    Get Setting by Key - Lấy setting theo key
    
    Yêu cầu permission "settings:read" để truy cập.
    """
    service = SettingsService(db)
    setting = await service.get_setting_by_key(key)
    
    if not setting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Setting not found")
    
    return setting


@router.post("", response_model=SettingResponse, status_code=status.HTTP_201_CREATED)
async def create_setting(
    request: Request,
    setting_data: SettingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:write"))
):
    """
    Create Setting - Tạo setting mới
    
    Yêu cầu permission "settings:write" để truy cập.
    """
    service = SettingsService(db)
    
    # Check if key already exists
    existing = await service.get_setting_by_key(setting_data.key)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Setting with key '{setting_data.key}' already exists"
        )
    
    setting = await service.create_setting(setting_data.model_dump())
    await db.commit()
    
    # Log audit
    audit_service = AuditService(db)
    await audit_service.log(
        action="create",
        module="settings",
        user_id=current_user.id,
        resource_type="Setting",
        resource_id=setting.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"key": setting.key, "category": setting.category.value, "name": setting.name}
    )
    await db.commit()
    
    return setting


@router.put("/{setting_id}", response_model=SettingResponse)
async def update_setting(
    request: Request,
    setting_id: int,
    setting_data: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:write"))
):
    """
    Update Setting - Cập nhật setting
    
    Yêu cầu permission "settings:write" để truy cập.
    """
    service = SettingsService(db)
    setting = await service.get_setting_by_id(setting_id)
    
    if not setting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Setting not found")
    
    # Store old values for audit log
    old_values = {
        key: getattr(setting, key)
        for key in setting_data.model_dump(exclude_unset=True).keys()
        if hasattr(setting, key)
    }
    
    update_data = setting_data.model_dump(exclude_unset=True)
    setting = await service.update_setting(setting, update_data)
    await db.commit()
    
    # Log audit
    audit_service = AuditService(db)
    await audit_service.log(
        action="update",
        module="settings",
        user_id=current_user.id,
        resource_type="Setting",
        resource_id=setting.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"key": setting.key, "old_values": old_values, "new_values": update_data}
    )
    await db.commit()
    
    return setting


@router.patch("/{setting_id}/value", response_model=SettingResponse)
async def update_setting_value(
    request: Request,
    setting_id: int,
    value_data: SettingValueUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:write"))
):
    """
    Update Setting Value - Cập nhật chỉ value của setting
    
    Yêu cầu permission "settings:write" để truy cập.
    """
    service = SettingsService(db)
    setting = await service.get_setting_by_id(setting_id)
    
    if not setting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Setting not found")
    
    old_value = setting.value
    setting.value = value_data.value
    await db.commit()
    await db.refresh(setting)
    
    # Log audit
    audit_service = AuditService(db)
    await audit_service.log(
        action="update_value",
        module="settings",
        user_id=current_user.id,
        resource_type="Setting",
        resource_id=setting.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"key": setting.key, "old_value": old_value, "new_value": value_data.value}
    )
    await db.commit()
    
    return setting


@router.post("/bulk-update")
async def bulk_update_settings(
    request: Request,
    bulk_data: BulkSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:write"))
):
    """
    Bulk Update Settings - Cập nhật nhiều settings cùng lúc
    
    Yêu cầu permission "settings:write" để truy cập.
    """
    service = SettingsService(db)
    updated_count = await service.bulk_update_settings(bulk_data.settings)
    await db.commit()
    
    # Log audit
    audit_service = AuditService(db)
    await audit_service.log(
        action="bulk_update",
        module="settings",
        user_id=current_user.id,
        resource_type="Setting",
        resource_id=None,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"updated_count": updated_count, "settings": bulk_data.settings}
    )
    await db.commit()
    
    return {"message": f"Updated {updated_count} settings", "updated_count": updated_count}


@router.delete("/{setting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_setting(
    request: Request,
    setting_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:delete"))
):
    """
    Delete Setting - Xóa setting
    
    Yêu cầu permission "settings:delete" để truy cập.
    """
    service = SettingsService(db)
    setting = await service.get_setting_by_id(setting_id)
    
    if not setting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Setting not found")
    
    # Store setting info for audit log before deletion
    setting_key = setting.key
    setting_name = setting.name
    
    await service.delete_setting(setting)
    await db.commit()
    
    # Log audit
    audit_service = AuditService(db)
    await audit_service.log(
        action="delete",
        module="settings",
        user_id=current_user.id,
        resource_type="Setting",
        resource_id=setting_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"key": setting_key, "name": setting_name}
    )
    await db.commit()
    
    return None

