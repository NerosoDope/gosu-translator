"""
Module: users.dependencies - FastAPI dependencies cho user authentication

Module này cung cấp FastAPI dependencies để xác thực user.

Mục đích:
    - Lấy current user từ JWT token
    - Verify JWT token và load user từ database

Ngữ cảnh:
    - Được sử dụng bởi tất cả protected endpoints
    - Verify JWT token và load user từ database
    - Tự động extract token từ Authorization header

Được sử dụng bởi:
    - Tất cả API endpoints cần authentication
    - RBAC dependencies cho permission checks

Xem thêm:
    - app/core/security.py cho JWT token functions
    - app/modules/auth/router.py cho login flow
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.core.security import verify_token
from app.modules.users.models import User

# OAuth2 scheme tự động extract token từ Authorization header
# Format: Authorization: Bearer <token>
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get Current User - FastAPI dependency để lấy user hiện tại từ JWT token
    
    Function này được sử dụng như dependency trong các protected endpoints.
    Nó tự động extract JWT token từ Authorization header, verify token,
    và lấy user từ database.
    
    Quy trình:
    1. Extract token từ Authorization header (Bearer <token>)
    2. Verify token signature và expiration
    3. Extract user_id từ token payload (field "sub")
    4. Load user từ database
    5. Trả về User object
    
    Args:
        token (str): JWT token từ Authorization header (tự động extract bởi oauth2_scheme)
        db (AsyncSession): Database session (tự động inject bởi FastAPI)
    
    Returns:
        User: User object từ database
    
    Raises:
        HTTPException: 401 Unauthorized nếu:
            - Không có token
            - Token invalid hoặc expired
            - User không tồn tại trong database
        HTTPException: 403 Forbidden nếu user bị inactive
    
    Example:
        @router.get("/protected")
        async def protected_route(current_user: User = Depends(get_current_user)):
            return {"user_id": current_user.id, "email": current_user.email}
    
    Lưu ý:
        - Token được extract từ header: Authorization: Bearer <token>
        - User_id được lấy từ "sub" field trong JWT payload
        - Function tự động log các lỗi authentication
        - Chỉ active users mới được phép truy cập
    """
    import logging
    logger = logging.getLogger(__name__)
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        logger.warning("No token provided")
        raise credentials_exception
    
    payload = verify_token(token)
    if payload is None:
        logger.warning(f"Token verification failed for token: {token[:20]}...")
        raise credentials_exception
    
    user_id = payload.get("sub")
    if user_id is None:
        logger.warning(f"No 'sub' in payload: {payload}")
        raise credentials_exception
    
    # Convert to int (JWT spec says sub can be string or int)
    try:
        user_id = int(user_id) if isinstance(user_id, str) else user_id
    except (ValueError, TypeError) as e:
        logger.error(f"Invalid user_id type: {type(user_id)}, value: {user_id}, error: {e}")
        raise credentials_exception
    
    # Lấy user từ database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if user is None:
        logger.warning(f"User not found with ID: {user_id}")
        raise credentials_exception
    
    if not user.is_active:
        logger.warning(f"User {user_id} is inactive")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    logger.debug(f"User authenticated: {user.email} (ID: {user.id})")
    return user

