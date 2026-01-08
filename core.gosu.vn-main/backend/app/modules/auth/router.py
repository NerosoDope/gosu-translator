"""
Module: auth.router - Router xác thực người dùng

Module này cung cấp các API endpoints cho authentication.

Mục đích:
    - Xử lý login, refresh token, logout
    - Cung cấp thông tin user hiện tại (me endpoint)
    - Quản lý JWT tokens (access token và refresh token)

Ngữ cảnh:
    - Authentication được thực hiện trực tiếp với database local
    - Core kiểm tra kết nối database trước khi xác thực
    - User credentials được lưu trữ và verify trong database local
    - JWT tokens được sử dụng cho tất cả các requests tiếp theo

Được sử dụng bởi:
    - Frontend core portal
    - Các internal services khác cần authentication

Xem thêm:
    - docs/architecture.md cho authentication flow
    - docs/conventions.md cho coding standards
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.db.session import get_db
from app.core.security import create_access_token, create_refresh_token, verify_token
import hashlib
from app.modules.users.dependencies import get_current_user
from app.modules.users.models import User
from app.modules.users.service import normalize_email
from app.modules.rbac.service import RBACService
from app.modules.rbac.dependencies import get_rbac_service
from app.modules.audit.service import AuditService
from datetime import timedelta
from app.core.config import settings
from pydantic import BaseModel
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def hash_password_md5(password: str) -> str:
    """
    Hash password sử dụng MD5
    
    Args:
        password: Plain text password
    
    Returns:
        MD5 hashed password (hexadecimal string)
    """
    return hashlib.md5(password.encode('utf-8')).hexdigest()


def verify_password_md5(plain_password: str, hashed_password: str) -> bool:
    """
    Verify password với MD5 hash
    
    Args:
        plain_password: Plain text password
        hashed_password: MD5 hashed password
    
    Returns:
        True nếu password đúng, False nếu sai
    """
    return hash_password_md5(plain_password) == hashed_password.lower()


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"


class PermissionResponse(BaseModel):
    """
    Schema response cho Permission
    
    Trả về thông tin permission bao gồm code, name, module, resource, action.
    """
    id: int
    code: str
    name: str
    module: Optional[str] = None
    resource: Optional[str] = None
    action: Optional[str] = None
    
    class Config:
        from_attributes = True


class RoleResponse(BaseModel):
    """
    Schema response cho Role
    
    Trả về thông tin role bao gồm code, name, description.
    """
    id: int
    code: str
    name: str
    description: Optional[str] = None
    
    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    """
    Schema response cho User
    
    Trả về thông tin user kèm permissions và roles.
    """
    id: int
    email: str
    full_name: Optional[str] = None
    permissions: List[PermissionResponse] = []
    roles: List[RoleResponse] = []


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Xác thực người dùng từ database local và phát hành JWT nội bộ.

    Quy trình:
    1. Kiểm tra kết nối database
    2. Tìm user trong database local theo email
    3. Kiểm tra trạng thái user (is_active)
    4. Verify password với MD5 hash trong database
    5. Phát hành access token và refresh token (JWT HS256)

    Raises:
        HTTPException 503: Nếu không thể kết nối database
        HTTPException 401: Nếu credentials không hợp lệ hoặc user không tồn tại
    """
    # Normalize email
    try:
        normalized_email = normalize_email(login_data.username)
    except Exception as e:
        logger.error(f"Email normalization failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email không hợp lệ"
        )
    
    # Helper function để log audit (non-blocking)
    async def log_audit(action: str, user_id: Optional[int], success: bool, reason: Optional[str] = None):
        try:
            audit_service = AuditService(db)
            await audit_service.log(
                action=action,
                module="auth",
                user_id=user_id,
                resource_type="User",
                resource_id=user_id,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                details={
                    "email": normalized_email,
                    "success": success,
                    "reason": reason
                }
            )
            await db.commit()
        except Exception as e:
            logger.error(f"Failed to log audit: {e}", exc_info=True)
            await db.rollback()
    
    # Bước 1: Kiểm tra kết nối database
    try:
        result = await db.execute(text("SELECT 1"))
        result.scalar()  # Consume the result
    except Exception as e:
        logger.error(f"Database connection failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không thể kết nối đến database. Vui lòng thử lại sau."
        )
    
    # Bước 2: Tìm user trong database local
    try:
        result = await db.execute(select(User).where(User.email == normalized_email))
        user = result.scalar_one_or_none()
    except Exception as e:
        logger.error(f"Database query failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Lỗi khi truy vấn database. Vui lòng thử lại sau."
        )
    
    
    # Bước 3: Kiểm tra user tồn tại
    if not user:
        logger.warning(f"User not found: {normalized_email}")
        await log_audit("login_failed", None, False, "User not found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không đúng"
        )
    
    # Bước 4: Kiểm tra trạng thái user
    if not user.is_active:
        logger.warning(f"Login attempt for inactive user: {normalized_email}")
        await log_audit("login_failed", user.id, False, "User inactive")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tài khoản của bạn đã bị vô hiệu hóa"
        )
    
    # Bước 5: Kiểm tra password có tồn tại và hợp lệ
    if not user.password or not isinstance(user.password, str) or len(user.password.strip()) == 0:
        logger.warning(f"User has no password set: {normalized_email}")
        await log_audit("login_failed", user.id, False, "No password set")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không đúng"
        )
    
    # Bước 6: Verify password với MD5
    try:
        if not login_data.password or len(login_data.password.strip()) == 0:
            logger.warning(f"Empty password provided for user: {normalized_email}")
            await log_audit("login_failed", user.id, False, "Empty password provided")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email hoặc mật khẩu không đúng"
            )
        
        plain_password = login_data.password.strip()
        
        # Verify password using MD5
        password_valid = verify_password_md5(plain_password, user.password)
        
        # Auto-upgrade: If password is stored as plain text, hash it with MD5 and save
        if not password_valid and user.password == plain_password:
            logger.info(f"Password match found for plain text password (user: {normalized_email}). Upgrading to MD5...")
            password_valid = True
            try:
                user.password = hash_password_md5(plain_password)
                await db.commit()
                logger.info(f"Password upgraded to MD5 for user: {normalized_email}")
            except Exception as e:
                logger.error(f"Failed to upgrade password to MD5: {e}", exc_info=True)
                await db.rollback()
                # Continue with login even if upgrade fails
        
    except HTTPException:
        # Re-raise HTTPException (from empty password check above)
        raise
    except Exception as e:
        # Other unexpected errors
        logger.error(f"Password verification error for user {normalized_email}: {e}", exc_info=True)
        await log_audit("login_failed", user.id, False, f"Password verification error: {type(e).__name__}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lỗi xác thực mật khẩu. Vui lòng thử lại sau."
        )
    
    if not password_valid:
        logger.warning(f"Invalid password for user: {normalized_email}")
        await log_audit("login_failed", user.id, False, "Invalid password")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không đúng"
        )
    
    # Bước 7: Phát hành JWT tokens
    try:
        access_token_expires = timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=access_token_expires
        )
        refresh_token = create_refresh_token(
            data={"sub": str(user.id)}
        )
    except Exception as e:
        logger.error(f"JWT token creation failed: {e}", exc_info=True)
        await log_audit("login_failed", user.id, False, "Token creation error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lỗi tạo token. Vui lòng thử lại sau."
        )
    
    logger.info(f"Login successful for: {normalized_email} (ID: {user.id})")
    
    # Log audit - successful login (non-blocking)
    try:
        await log_audit("login", user.id, True)
    except Exception as e:
        logger.error(f"Failed to log successful login audit: {e}", exc_info=True)
        # Continue even if audit logging fails
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Làm mới access token sử dụng refresh token.

    Quy trình:
    1. Validate refresh token signature và expiry
    2. Extract user identifier từ token payload
    3. Phát hành access token mới với cùng user identity
    4. Trả về access token mới (refresh token giữ nguyên)

    Lý do sử dụng refresh tokens:
    - Access tokens có TTL ngắn (bảo mật)
    - Refresh tokens cho phép mở rộng session liền mạch
    - User không cần login lại thường xuyên

    Raises:
        HTTPException 401: Nếu refresh token không hợp lệ hoặc đã hết hạn
    """
    # Validate refresh token: Phải là JWT hợp lệ và có type="refresh"
    # Điều này ngăn việc sử dụng access tokens như refresh tokens
    payload = verify_token(refresh_token)
    
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Phát hành access token mới với cùng user identity
    # Refresh token không được rotate ở đây (có thể implement để tăng bảo mật)
    access_token_expires = timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": payload.get("sub")},
        expires_delta=access_token_expires
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,  # Refresh token vẫn giữ nguyên
        token_type="bearer"
    )


@router.post("/logout")
async def logout(
    request: Request,
    refresh_token: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Đăng xuất user bằng cách thu hồi refresh token.

    Quy trình:
    1. Thêm refresh token vào blacklist (Redis)
    2. Vô hiệu hóa tất cả sessions liên quan
    3. Trả về success

    Lý do sử dụng blacklist:
    - Ngay cả khi token bị đánh cắp, không thể sử dụng sau khi logout
    - Blacklist được kiểm tra mỗi lần validate token
    - TTL khớp với refresh token expiry

    Args:
        request: FastAPI request object để lấy IP và user agent
        refresh_token: Refresh token cần thu hồi (optional, cho explicit logout)
        db: Database session
        current_user: Current authenticated user (optional, có thể None nếu token invalid)

    TODO: Implement token blacklist trong Redis
    Hiện tại chỉ return success (stateless JWT)
    """
    
    # Log audit - logout event (nếu có user)
    if current_user:
        audit_service = AuditService(db)
        await audit_service.log(
            action="logout",
            module="auth",
            user_id=current_user.id,
            resource_type="User",
            resource_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            details={"email": current_user.email}
        )
        await db.commit()
    
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    rbac: RBACService = Depends(get_rbac_service)
):
    """
    Lấy thông tin user hiện tại - Get Current User
    
    Endpoint này trả về thông tin của user đang đăng nhập, bao gồm permissions và roles.
    Không cần permission đặc biệt vì user luôn có quyền xem thông tin của chính mình.
    
    Quy trình:
    1. Extract JWT token từ Authorization header (via get_current_user)
    2. Verify token và lấy user_id
    3. Load user từ database
    4. Lấy user permissions và roles từ RBAC service
    5. Trả về thông tin user kèm permissions và roles
    
    Returns:
        UserResponse: Thông tin user hiện tại, bao gồm permissions và roles
    
    Raises:
        HTTPException: 401 nếu token invalid hoặc user không tồn tại
    """
    # Lấy user permissions
    permissions = await rbac.get_user_permissions(current_user.id)
    
    # Lấy user roles
    roles = await rbac.get_user_roles(current_user.id)
    
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        permissions=[PermissionResponse(
            id=p.id,
            code=p.code,
            name=p.name,
            module=p.module,
            resource=p.resource,
            action=p.action
        ) for p in permissions],
        roles=[RoleResponse(
            id=r.id,
            code=r.code,
            name=r.name,
            description=r.description
        ) for r in roles]
    )

