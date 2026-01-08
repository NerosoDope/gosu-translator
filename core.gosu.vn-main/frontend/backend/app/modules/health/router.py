"""
Module Health Check - Router kiểm tra sức khỏe hệ thống

Module này cung cấp các endpoints để kiểm tra trạng thái và readiness của API.

Mục đích:
    - Health check endpoint (/healthz) - Kiểm tra API có đang chạy không
    - Readiness check endpoint (/readyz) - Kiểm tra API sẵn sàng nhận requests

Ngữ cảnh:
    - Được sử dụng bởi load balancers và monitoring systems
    - Health check chỉ kiểm tra API có đang chạy
    - Readiness check kiểm tra dependencies (database, Redis, etc.)

Được sử dụng bởi:
    - Kubernetes liveness/readiness probes
    - Load balancers
    - Monitoring systems

Xem thêm:
    - docs/architecture.md cho health check strategy

Author: GOSU Development Team
Version: 1.0.0
"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.db.session import AsyncSessionLocal
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/healthz")
@router.head("/healthz")
async def health_check():
    """
    Health check endpoint - Kiểm tra trạng thái API
    """
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT
    }


@router.get("/readyz")
@router.head("/readyz")
async def readiness_check():
    """
    Readiness check endpoint - Kiểm tra API sẵn sàng nhận requests
    
    Kiểm tra kết nối database để đảm bảo API có thể xử lý requests.
    TODO: Thêm kiểm tra Redis, MinIO connections
    """
    checks = {
        "status": "ready",
        "version": settings.APP_VERSION,
        "checks": {
            "database": {"status": "unknown"}
        }
    }
    
    # Kiểm tra kết nối database
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("SELECT 1"))
            row = result.scalar()
            if row == 1:
                checks["checks"]["database"]["status"] = "healthy"
                # Lấy thêm thông tin về database
                try:
                    db_result = await session.execute(text("SELECT current_database(), version()"))
                    db_info = db_result.fetchone()
                    if db_info:
                        checks["checks"]["database"]["database_name"] = db_info[0]
                        checks["checks"]["database"]["version"] = db_info[1].split(",")[0]  # First line of version
                except Exception as e:
                    logger.warning(f"Could not fetch database info: {e}")
            else:
                checks["checks"]["database"]["status"] = "unhealthy"
                checks["status"] = "not_ready"
    except Exception as e:
        logger.error(f"Database connection check failed: {e}", exc_info=True)
        checks["checks"]["database"]["status"] = "unhealthy"
        checks["checks"]["database"]["error"] = str(e)
        checks["status"] = "not_ready"
    
    # Nếu database không healthy, trả về error status
    if checks["checks"]["database"]["status"] != "healthy":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=checks
        )
    
    return checks


@router.get("/db-check")
async def database_check():
    """
    Database connection check endpoint - Kiểm tra chi tiết kết nối database
    
    Endpoint này cung cấp thông tin chi tiết về kết nối database,
    hữu ích cho việc debug và troubleshooting.
    """
    result = {
        "status": "unknown",
        "database_url": settings.DATABASE_URL.split("@")[0] + "@...",  # Hide password
        "checks": {}
    }
    
    try:
        # Test 1: Basic connection test
        async with AsyncSessionLocal() as session:
            db_result = await session.execute(text("SELECT 1 as test"))
            test_value = db_result.scalar()
            if test_value == 1:
                result["checks"]["basic_query"] = "success"
            else:
                result["checks"]["basic_query"] = "failed"
                result["status"] = "failed"
                return result
        
        # Test 2: Get database info
        async with AsyncSessionLocal() as session:
            db_result = await session.execute(text("SELECT current_database(), current_user, version()"))
            db_info = db_result.fetchone()
            if db_info:
                result["checks"]["database_info"] = {
                    "database_name": db_info[0],
                    "current_user": db_info[1],
                    "version": db_info[2].split("\n")[0]  # First line
                }
        
        # Test 3: Get connection count
        async with AsyncSessionLocal() as session:
            db_result = await session.execute(text("""
                SELECT count(*) 
                FROM pg_stat_activity 
                WHERE datname = current_database()
            """))
            conn_count = db_result.scalar()
            result["checks"]["connection_count"] = conn_count
        
        # Test 4: Check for tables
        async with AsyncSessionLocal() as session:
            db_result = await session.execute(text("""
                SELECT count(*) 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            """))
            table_count = db_result.scalar()
            result["checks"]["table_count"] = table_count
        
        result["status"] = "connected"
        return result
        
    except Exception as e:
        logger.error(f"Database check failed: {e}", exc_info=True)
        result["status"] = "failed"
        result["error"] = {
            "type": type(e).__name__,
            "message": str(e)
        }
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result
        )

