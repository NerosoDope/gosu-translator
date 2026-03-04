"""
Module Database Session - SQLAlchemy 2 async

Module này cung cấp kết nối và quản lý database session.

Mục đích:
    - Tạo database engine cho PostgreSQL với async driver (asyncpg)
    - Tạo session factory để tạo database sessions
    - Cung cấp Base class cho tất cả SQLAlchemy models
    - Cung cấp FastAPI dependency (get_db) để inject database session

Ngữ cảnh:
    - Sử dụng SQLAlchemy 2.0 async style
    - Database URL được convert từ postgresql:// sang postgresql+asyncpg://
    - Connection pool được cấu hình với pool_pre_ping=True để tự động reconnect
    - Session được tự động close sau mỗi request

Được sử dụng bởi:
    - Tất cả API endpoints cần truy cập database
    - Business logic services
    - Database migrations (Alembic)

Xem thêm:
    - docs/architecture.md cho database architecture

Author: GOSU Development Team
Version: 1.0.0
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from app.core.config import settings

# Database engine
# Convert database URL để sử dụng asyncpg driver (async PostgreSQL driver)
# pool_pre_ping=True: Tự động kiểm tra và reconnect nếu connection bị mất
# pool_size: Số lượng connections trong pool (tối ưu cho production)
# max_overflow: Số lượng connections tối đa có thể vượt quá pool_size
engine = create_async_engine(
    settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://").replace("postgresql+psycopg://", "postgresql+asyncpg://"),
    echo=False,  # Tắt log SQL (tránh in query trong jobs/worker)
    future=True,
    pool_pre_ping=True,  # Tự động kiểm tra và reconnect nếu connection bị mất
    pool_size=10,  # Số lượng connections trong pool
    max_overflow=20,  # Số lượng connections tối đa có thể vượt quá pool_size
    pool_recycle=3600,  # Recycle connections sau 1 giờ để tránh stale connections
    connect_args={
        "server_settings": {
            "application_name": "gosu_core_api",  # Tên application trong PostgreSQL logs
        },
        "timeout": 60,  # Connection timeout (giây)
        "command_timeout": 60,  # Query timeout (giây)
    }
)

# Session factory
# Tạo session factory để tạo database sessions
# expire_on_commit=False: Objects không bị expire sau commit (có thể truy cập sau commit)
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Base class for models
# Tất cả SQLAlchemy models phải inherit từ Base này
Base = declarative_base()


async def get_db():
    """
    FastAPI Dependency - Lấy database session
    
    Function này được sử dụng như FastAPI dependency để inject database session vào endpoints.
    Session được tự động close sau khi request hoàn thành.
    
    Yields:
        AsyncSession: Database session để sử dụng trong endpoint
    
    Example:
        @router.get("/users")
        async def get_users(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(User))
            return result.scalars().all()
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

