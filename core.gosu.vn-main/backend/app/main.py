"""
Điểm vào chính của ứng dụng (Main Application Entry Point)

FastAPI application entry point với tất cả configurations và routers.

Mục đích:
    - Khởi tạo FastAPI application với tất cả cấu hình
    - Đăng ký các routers cho các modules (auth, users, rbac, files, health)
    - Setup middleware và exception handlers
    - Cấu hình CORS cho frontend

Ngữ cảnh:
    - Application chạy trên port 8000 (có thể config qua API_PORT)
    - Tất cả API endpoints có prefix /api/v1
    - Swagger docs chỉ hiển thị khi DEBUG=True

Được sử dụng bởi:
    - Frontend core portal
    - Các internal services khác

Xem thêm:
    - docs/architecture.md cho kiến trúc tổng thể
    - docs/conventions.md cho coding standards

Author: GOSU Development Team
Version: 1.0.0
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.middleware import setup_middleware
from app.core.exceptions import setup_exception_handlers
from app.modules.auth import router as auth_router
from app.modules.health import router as health_router
from app.modules.files import router as files_router
from app.modules.rbac import router as rbac_router
from app.modules.users import router as users_router
from app.modules.dashboard import router as dashboard_router
from app.modules.audit import router as audit_router
from app.modules.settings import router as settings_router

from app.modules.cache import router as cache_router
from app.modules.prompts import router as prompts_router
from app.modules.game_category import router as game_category_router
from app.modules.game_glossary import router as game_glossary_router
from app.modules.language import router as language_router
from app.modules.job import router as job_router
from app.modules.translate import router as translate_router
from app.modules.global_glossary import router as global_glossary_router
from app.modules.game import router as game_router
from app.modules.import_batches import router as import_batches_router
from app.modules.quality_check import router as quality_check_router

import logging

# Khởi tạo logging
setup_logging()
logger = logging.getLogger(__name__)

# Tạo FastAPI application
app = FastAPI(
    title="GOSU Core Platform API",
    version=settings.APP_VERSION,
    description="Core Platform API - Template cho các dự án GOSU",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None
)

# Cấu hình CORS
# Cho phép frontend gọi API từ các origins được cấu hình
cors_origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
if settings.DEBUG:
    cors_origins = list(dict.fromkeys([
        "http://localhost:3000",
        "http://192.168.90.239:3000"
    ] + (cors_origins or []))) 

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Setup custom middleware (request ID, process time, logging)
setup_middleware(app)

# Setup exception handlers (global error handling)
setup_exception_handlers(app)

# Đăng ký các routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(health_router, prefix="/api/v1", tags=["health"])
app.include_router(files_router, prefix="/api/v1/files", tags=["files"])
app.include_router(rbac_router, prefix="/api/v1/rbac", tags=["rbac"])
app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(settings_router, prefix="/api/v1/settings", tags=["settings"])
app.include_router(audit_router, prefix="/api/v1/audit", tags=["audit"])

app.include_router(cache_router, prefix="/api/v1/cache", tags=["cache"])
app.include_router(prompts_router, prefix="/api/v1/prompts", tags=["prompts"])
app.include_router(game_category_router, prefix="/api/v1/game-category", tags=["game-category"])
app.include_router(game_glossary_router, prefix="/api/v1/game-glossary", tags=["game-glossary"])
app.include_router(global_glossary_router, prefix="/api/v1/global-glossary", tags=["global-glossary"])
app.include_router(game_router, prefix="/api/v1/game", tags=["game"])
app.include_router(language_router, prefix="/api/v1/languages", tags=["languages"])
app.include_router(job_router, prefix="/api/v1/job", tags=["job"])
app.include_router(translate_router, prefix="/api/v1/translate", tags=["translate"])
app.include_router(import_batches_router, prefix="/api/v1/import-batches", tags=["import-batches"])
app.include_router(quality_check_router, prefix="/api/v1/quality-check", tags=["quality-check"])


@app.get("/")
async def root():
    """
    Root endpoint - Trả về thông tin cơ bản của API
    
    Endpoint này được sử dụng để kiểm tra API có đang chạy không.
    """
    return {
        "message": "GOSU Core Platform API",
        "version": settings.APP_VERSION,
        "status": "running",
        "environment": settings.ENVIRONMENT
    }


async def _cache_ttl_cleanup_loop():
    """Background task: mỗi 60 giây quét và xóa cache entries đã hết TTL."""
    import asyncio
    from app.db.session import AsyncSessionLocal
    from app.modules.cache.service import CacheService

    await asyncio.sleep(10)  # chờ app khởi động xong
    while True:
        try:
            async with AsyncSessionLocal() as db:
                deleted = await CacheService(db).cleanup_expired()
                if deleted:
                    logger.info(f"[Cache TTL] Đã xóa {deleted} cache entries hết hạn.")
        except Exception as e:
            logger.error(f"[Cache TTL] Lỗi khi dọn cache hết hạn: {e}", exc_info=True)
        await asyncio.sleep(60)


@app.on_event("startup")
async def startup_event():
    """
    Startup event handler - Xử lý khi application khởi động

    Log thông tin về environment và debug mode khi app start.
    Tự động seed permissions và gán cho ADMIN role.
    """
    import asyncio

    logger.info("GOSU Core Platform API starting...")
    logger.info("Environment: %s | Debug: %s", settings.ENVIRONMENT, settings.DEBUG)
    
    # Tự động seed permissions và gán cho ADMIN role
    from app.core.startup import seed_permissions_on_startup
    await seed_permissions_on_startup()

    # Khởi động background task tự động xóa cache hết hạn TTL
    asyncio.create_task(_cache_ttl_cleanup_loop())
    logger.info("[Cache TTL] Background cleanup task đã được khởi động (interval: 60s).")

    # Khởi động job priority worker
    from app.modules.job.worker import job_worker_loop
    asyncio.create_task(job_worker_loop())
    logger.info("[Worker] Job priority worker đã được khởi động.")
    logger.info("Backend ready. API: http://0.0.0.0:8000")
