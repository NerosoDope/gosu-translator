"""
Module: users.service - Service đồng bộ user

Module này cung cấp service để đồng bộ user từ apis.gosu.vn.

Mục đích:
    - Đồng bộ user từ external GOSU API sau khi login thành công
    - Tạo/cập nhật user trong database local

Ngữ cảnh:
    - Users được sync từ external GOSU API sau khi login
    - User data đến từ endpoint /v1/hrm/employee/profile
    - EmployeeId từ GOSU API được dùng làm user.id

Được sử dụng bởi:
    - Auth module để sync user sau login
    - User management endpoints

Xem thêm:
    - app/integrations/gosu_apis_client.py cho API client
    - app/modules/auth/router.py cho login flow
"""

from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.users.models import User
from app.integrations.gosu_apis_client import gosu_api_client
import logging

logger = logging.getLogger(__name__)


def normalize_email(email: str) -> str:
    """
    Normalize email - Chuẩn hóa email format
    
    Function này chuẩn hóa email:
    - Tự động thêm @gosu.vn nếu không có domain
    - Convert to lowercase
    - Trim whitespace
    
    Args:
        email (str): Email cần chuẩn hóa
    
    Returns:
        str: Email đã được chuẩn hóa
    
    Example:
        normalize_email("user") -> "user@gosu.vn"
        normalize_email("User@GOSU.VN") -> "user@gosu.vn"
    """
    if not email:
        return email
    
    email = email.strip().lower()
    
    if "@" not in email:
        return f"{email}@gosu.vn"
    
    return email


async def sync_user_from_gosu_api(
    db: AsyncSession,
    erp_data: Dict[str, Any],
    email: str,
    erp_token: Optional[str] = None
) -> User:
    """
    Sync User from GOSU API - Đồng bộ user từ apis.gosu.vn vào DB local
    
    Function này nhận data từ GOSU API và sync vào database local.
    Nếu user đã tồn tại (theo email), sẽ update thông tin.
    Nếu chưa tồn tại, sẽ tạo user mới.
    
    Flow:
    1. Extract thông tin từ erp_data (EmployeeId, FullName, Email, AvatarUrl, etc.)
    2. Tìm user trong DB theo email
    3. Nếu có: Update thông tin (full_name, avatar)
    4. Nếu không: Tạo user mới với ID từ EmployeeId
    5. Commit và refresh user
    
    Args:
        db (AsyncSession): Database session
        erp_data (Dict[str, Any]): Data từ GOSU API response
                                   Format: EmployeeId, FullName, Email, AvatarUrl, Mobiphone, etc.
        email (str): Email đã được chuẩn hóa
        erp_token (Optional[str]): Token từ GOSU API (optional, for future use)
    
    Returns:
        User: User object đã được sync (created hoặc updated)
    
    Example:
        erp_data = {
            "EmployeeId": "123",
            "FullName": "Nguyễn Văn A",
            "Email": "nguyenvana@gosu.vn",
            "Mobiphone": "0123456789",
            "AvatarUrl": "https://..."
        }
        user = await sync_user_from_gosu_api(db, erp_data, "nguyenvana@gosu.vn")
    
    Note:
        - EmployeeId được dùng làm user.id (BigInteger)
        - Email từ erp_data sẽ override email parameter nếu có
        - Function tự động commit transaction
    """
    # Extract data từ GOSU API format
    # Format từ v1/hrm/employee/profile: EmployeeId, FullName, Email, AvatarUrl, Mobiphone, etc.
    erp_user_id = erp_data.get("EmployeeId") or erp_data.get("Id")
    full_name = erp_data.get("FullName") or erp_data.get("FullName")
    erp_email = erp_data.get("Email")
    avatar_url = erp_data.get("AvatarUrl") or erp_data.get("Avatar")
    phone = erp_data.get("Mobiphone") or erp_data.get("Phone")
    
    # Use email from erp_data if available, otherwise use provided email
    final_email = normalize_email(erp_email) if erp_email else normalize_email(email)
    
    # Convert EmployeeId to int for user.id
    user_id = None
    if erp_user_id:
        try:
            user_id = int(erp_user_id)
        except (ValueError, TypeError):
            logger.warning(f"Cannot convert EmployeeId to int: {erp_user_id}")
    
    # Tìm user trong DB theo email hoặc ID
    query = select(User)
    if user_id:
        query = query.where(User.id == user_id)
    else:
        query = query.where(User.email == final_email)
    
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if user:
        # Update existing user
        if full_name:
            user.full_name = full_name
        if avatar_url:
            user.avatar = avatar_url
        logger.info(f"Updated user from GOSU API: {final_email} (ID: {user.id})")
    else:
        # Tạo user mới
        if not user_id:
            # Nếu không có EmployeeId, không thể tạo user (ID là required)
            raise ValueError(f"Cannot create user without EmployeeId. Email: {final_email}")
        
        user = User(
            id=user_id,
            email=final_email,
            full_name=full_name,
            avatar=avatar_url,
            is_active=True
        )
        db.add(user)
        logger.info(f"Created new user from GOSU API: {final_email} (ID: {user.id})")
    
    await db.commit()
    await db.refresh(user)
    return user

