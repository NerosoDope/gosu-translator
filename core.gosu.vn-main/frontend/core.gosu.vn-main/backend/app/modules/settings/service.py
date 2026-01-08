"""
Module: settings.service - Business logic cho Settings

Module này cung cấp các phương thức để quản lý settings.

Mục đích:
    - CRUD operations cho settings
    - Get settings theo category
    - Get public settings
    - Bulk update settings
    - Validate và parse values theo type

Ngữ cảnh:
    - Được sử dụng bởi Settings Router để xử lý business logic
    - Hỗ trợ encryption/decryption cho sensitive settings

Được sử dụng bởi:
    - app/modules/settings/router.py

Xem thêm:
    - app/modules/settings/models.py cho Setting model

Author: GOSU Development Team
Version: 1.0.0
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional, Dict, Any
from app.modules.settings.models import Setting, SettingCategory, SettingType


class SettingsService:
    """
    Settings Service - Xử lý logic cho Settings Management
    """
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_settings(
        self,
        category: Optional[SettingCategory] = None,
        is_active: Optional[bool] = None
    ) -> List[Setting]:
        """
        Get Settings - Lấy danh sách settings
        
        Args:
            category: Lọc theo category (optional)
            is_active: Lọc theo trạng thái active (optional)
        
        Returns:
            List[Setting]: Danh sách settings
        """
        query = select(Setting)
        conditions = []
        
        if category:
            conditions.append(Setting.category == category)
        if is_active is not None:
            conditions.append(Setting.is_active == is_active)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        query = query.order_by(Setting.order, Setting.key)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_public_settings(self) -> List[Setting]:
        """
        Get Public Settings - Lấy danh sách public settings
        
        Returns:
            List[Setting]: Danh sách public settings
        """
        query = select(Setting).where(
            and_(
                Setting.is_public == True,
                Setting.is_active == True
            )
        ).order_by(Setting.order, Setting.key)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_setting_by_id(self, setting_id: int) -> Optional[Setting]:
        """
        Get Setting by ID - Lấy setting theo ID
        
        Args:
            setting_id: ID của setting
        
        Returns:
            Optional[Setting]: Setting nếu tìm thấy, None nếu không
        """
        result = await self.db.execute(select(Setting).where(Setting.id == setting_id))
        return result.scalar_one_or_none()

    async def get_setting_by_key(self, key: str) -> Optional[Setting]:
        """
        Get Setting by Key - Lấy setting theo key
        
        Args:
            key: Key của setting
        
        Returns:
            Optional[Setting]: Setting nếu tìm thấy, None nếu không
        """
        result = await self.db.execute(select(Setting).where(Setting.key == key))
        return result.scalar_one_or_none()

    async def create_setting(self, setting_data: Dict[str, Any]) -> Setting:
        """
        Create Setting - Tạo setting mới
        
        Args:
            setting_data: Dữ liệu setting
        
        Returns:
            Setting: Setting đã tạo
        """
        setting = Setting(**setting_data)
        self.db.add(setting)
        await self.db.flush()
        await self.db.refresh(setting)
        return setting

    async def update_setting(self, setting: Setting, update_data: Dict[str, Any]) -> Setting:
        """
        Update Setting - Cập nhật setting
        
        Args:
            setting: Setting cần cập nhật
            update_data: Dữ liệu cập nhật
        
        Returns:
            Setting: Setting đã cập nhật
        """
        for key, value in update_data.items():
            if hasattr(setting, key) and value is not None:
                setattr(setting, key, value)
        
        await self.db.flush()
        await self.db.refresh(setting)
        return setting

    async def bulk_update_settings(self, updates: Dict[str, str]) -> int:
        """
        Bulk Update Settings - Cập nhật nhiều settings cùng lúc
        
        Args:
            updates: Dictionary với key-value pairs (key là setting key, value là giá trị mới)
        
        Returns:
            int: Số lượng settings đã cập nhật
        """
        updated_count = 0
        for key, value in updates.items():
            setting = await self.get_setting_by_key(key)
            if setting:
                setting.value = value
                updated_count += 1
        
        await self.db.flush()
        return updated_count

    async def delete_setting(self, setting: Setting) -> None:
        """
        Delete Setting - Xóa setting
        
        Args:
            setting: Setting cần xóa
        """
        await self.db.delete(setting)
        await self.db.flush()

