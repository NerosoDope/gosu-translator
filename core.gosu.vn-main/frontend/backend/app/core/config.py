"""
Module cấu hình hệ thống (Configuration Module)

Module này quản lý tất cả các cấu hình của GOSU Core Platform.
Sử dụng Pydantic Settings v2 để tự động load từ environment variables hoặc file .env.

Mục đích:
    - Định nghĩa tất cả các biến cấu hình cần thiết
    - Validate các giá trị cấu hình (JWT secret, database URL, etc.)
    - Tự động load từ file .env trong thư mục deploy/

Ngữ cảnh:
    - File .env được đặt tại deploy/.env
    - Tất cả secrets phải được set trong .env (không hardcode)
    - DEBUG phải là False trong production

Được sử dụng bởi:
    - Tất cả modules trong hệ thống
    - Database connection, JWT security, external API clients

Xem thêm:
    - docs/env.md cho hướng dẫn cấu hình environment variables

Author: GOSU Development Team
Version: 1.0.0
"""

from pydantic_settings import BaseSettings
from pydantic import Field, validator
from typing import List, Optional
from pathlib import Path

# Xác định đường dẫn đến file .env trong project root
# File .env được đặt trong thư mục deploy/ để dễ quản lý với docker-compose
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_FILE = BASE_DIR / "deploy" / ".env"


class Settings(BaseSettings):
    """
    Cấu hình ứng dụng GOSU Core Platform
    
    Class này định nghĩa tất cả các biến cấu hình cần thiết cho hệ thống.
    Tự động load từ environment variables hoặc file .env.
    """
    
    # Application
    APP_NAME: str = "GOSU Core Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = Field(default=False, description="Debug mode (MUST be False in production)")
    ENVIRONMENT: str = Field(default="production", description="Environment: development/staging/production")
    API_PORT: int = 8000
    
    # SSL Configuration
    SSL_VERIFY: bool = Field(default=True, description="Enable SSL verification for external API calls")
    SSL_CA_BUNDLE: Optional[str] = Field(default=None, description="Optional CA bundle path for self-signed certs (dev only)")
    
    # Database
    DATABASE_URL: str = Field(..., description="Database connection URL (required from env)")
    
    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    
    # MinIO
    MINIO_ENDPOINT: str = "http://minio:9000"
    MINIO_ACCESS_KEY: str = Field(..., description="MinIO access key (required from env)")
    MINIO_SECRET_KEY: str = Field(..., description="MinIO secret key (required from env)")
    MINIO_BUCKET_NAME: str = "core-files"
    MINIO_SECURE: bool = False
    
    # JWT
    JWT_SECRET_KEY: str = Field(..., min_length=32, description="JWT secret key (min 32 chars, required from env)")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = Field(default=30, ge=5, le=60, description="JWT expiration in minutes (5-60)")
    JWT_REFRESH_EXPIRE_DAYS: int = Field(default=7, ge=1, le=30, description="Refresh token expiration in days")
    
    # GOSU APIs Integration
    GOSU_API_URL: str = "https://apis.gosu.vn"
    GOSU_APP_ID: str = "UA"
    GOSU_SECRET: str = Field(..., description="GOSU API secret (required from env)")
    
    # CORS
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000",
        description="Allowed CORS origins (comma-separated string)"
    )
    ALLOWED_HOSTS: List[str] = ["*"]
    
    # Frontend URLs
    FRONTEND_URL: str = "http://localhost:3000"
    
    # File Upload
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_FILE_TYPES: List[str] = [
        "image/jpeg", "image/png", "image/gif",
        "application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ]
    
    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100
    
    class Config:
        env_file = str(ENV_FILE) if ENV_FILE.exists() else None
        env_file_encoding = 'utf-8'
        case_sensitive = True
        extra = "ignore"
    
    @validator('JWT_SECRET_KEY')
    def validate_jwt_secret(cls, v):
        """
        Validate JWT secret key strength - Kiểm tra độ mạnh của JWT secret key
        
        Yêu cầu:
        - Phải có giá trị (không được rỗng)
        - Độ dài tối thiểu 32 ký tự
        - Không được sử dụng các giá trị yếu như "secret", "password", etc.
        """
        if not v:
            raise ValueError("JWT_SECRET_KEY is required")
        if len(v) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters")
        weak_secrets = ["supersecret", "secret", "changeme", "password", "123456"]
        if v.lower() in weak_secrets:
            raise ValueError(f"JWT_SECRET_KEY cannot use weak/default value: {v}")
        return v
    
    @validator('DATABASE_URL')
    def validate_database_url(cls, v):
        """
        Validate database URL - Kiểm tra database URL không sử dụng password mặc định
        
        Yêu cầu:
        - Phải có giá trị
        - Không được sử dụng password mặc định "password"
        """
        if not v:
            raise ValueError("DATABASE_URL is required")
        if "password@postgres" in v or ":password@" in v:
            raise ValueError("DATABASE_URL cannot use default password 'password'. Use strong password from .env")
        return v
    
    @validator('GOSU_SECRET')
    def validate_gosu_secret(cls, v):
        """
        Validate GOSU secret - Kiểm tra GOSU API secret không bị hardcode
        
        Yêu cầu:
        - Phải có giá trị (phải được set trong .env)
        """
        if not v:
            raise ValueError("GOSU_SECRET is required")
        return v
    
    @validator('DEBUG')
    def validate_debug_mode(cls, v, values):
        """
        Ensure DEBUG is False in production - Đảm bảo DEBUG=False trong production
        
        Yêu cầu:
        - Nếu ENVIRONMENT=production thì DEBUG phải là False
        - Tránh lộ thông tin nhạy cảm trong production
        """
        environment = values.get('ENVIRONMENT', 'development')
        if environment == 'production' and v:
            raise ValueError("DEBUG must be False in production environment")
        return v


# Tạo instance settings global
# Nếu load settings thất bại, application sẽ không khởi động được
# Điều này đảm bảo tất cả cấu hình cần thiết đã được set đúng
try:
    settings = Settings()
except Exception as e:
    import sys
    print(f"ERROR: Failed to load settings: {e}", file=sys.stderr)
    print("Please check your .env file and ensure all required secrets are set.", file=sys.stderr)
    sys.exit(1)

