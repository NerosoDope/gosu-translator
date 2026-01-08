"""
Module bảo mật - JWT và Password Hashing

Module này cung cấp các chức năng bảo mật cho hệ thống.

Mục đích:
    - Tạo và verify JWT tokens (access token và refresh token)
    - Hash và verify passwords sử dụng bcrypt
    - Quản lý token expiration và refresh logic

Ngữ cảnh:
    - JWT sử dụng HS256 algorithm (symmetric key)
    - Access token có TTL ngắn (30 phút mặc định)
    - Refresh token có TTL dài (7 ngày mặc định)
    - Passwords được hash bằng bcrypt với salt tự động

Được sử dụng bởi:
    - Auth router cho login/logout/refresh
    - User dependencies cho authentication
    - Các endpoints cần verify JWT tokens

Xem thêm:
    - docs/architecture.md cho authentication flow

Author: GOSU Development Team
Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

# Password context cho bcrypt hashing
# Sử dụng bcrypt với salt tự động để hash passwords
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Tạo JWT access token
    
    Args:
        data: Dữ liệu để encode vào token (thường là user_id, employee_code)
        expires_delta: Thời gian hết hạn tùy chỉnh. Nếu None, dùng JWT_EXPIRE_MINUTES
    
    Returns:
        JWT token string
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """
    Tạo JWT refresh token
    
    Args:
        data: Dữ liệu để encode vào token
    
    Returns:
        JWT refresh token string
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify JWT token và trả về payload
    
    Args:
        token: JWT token string cần verify
    
    Returns:
        Payload của token nếu valid, None nếu invalid/expired
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def hash_password(password: str) -> str:
    """
    Hash password sử dụng bcrypt
    
    Args:
        password: Plain text password
    
    Returns:
        Hashed password
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify password với hash
    
    Args:
        plain_password: Plain text password
        hashed_password: Hashed password
    
    Returns:
        True nếu password đúng, False nếu sai
    """
    return pwd_context.verify(plain_password, hashed_password)

