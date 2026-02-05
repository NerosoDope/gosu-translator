"""
Module xử lý exceptions - Xử lý exceptions và errors

Module này cung cấp xử lý lỗi tập trung cho toàn bộ application.

Mục đích:
    - Định nghĩa custom exception class (AppException) cho business logic errors
    - Xử lý tất cả exceptions và trả về response format chuẩn
    - Đảm bảo tất cả errors đều có request ID để tracking

Ngữ cảnh:
    - AppException: Custom exception cho business logic errors (có thể set status_code)
    - HTTPException: Xử lý HTTP errors (404, 403, etc.)
    - RequestValidationError: Xử lý validation errors từ Pydantic
    - Exception: Xử lý tất cả unhandled exceptions (500 error)

Được sử dụng bởi:
    - Tất cả API endpoints khi raise exceptions
    - Business logic services khi cần throw errors

Xem thêm:
    - docs/architecture.md cho error handling strategy

Author: GOSU Development Team
Version: 1.0.0
"""

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import uuid
from app.core.config import settings

logger = logging.getLogger(__name__)


class AppException(Exception):
    """
    Base exception class cho Core Platform
    
    Custom exception class để xử lý các lỗi business logic.
    Có thể set status_code tùy chỉnh cho từng loại lỗi.
    
    Attributes:
        message: Thông báo lỗi
        status_code: HTTP status code (default: 400)
        code: Error code để frontend xử lý (default: "APP_ERROR")
        details: Chi tiết bổ sung về lỗi (dict)
    """
    def __init__(self, message: str, status_code: int = 400, code: str = None, details: dict = None):
        self.message = message
        self.status_code = status_code
        self.code = code or "APP_ERROR"
        self.details = details or {}
        super().__init__(self.message)


def setup_exception_handlers(app):
    """
    Setup global exception handlers cho FastAPI application
    
    Args:
        app: FastAPI application instance
    """
    
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        """
        Handler cho AppException - Xử lý custom business logic errors
        
        Trả về response format chuẩn với error code, message, và details.
        """
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details
                },
                "request_id": request_id
            }
        )
    
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        """
        Handler cho HTTPException - Xử lý HTTP errors (404, 403, etc.)
        
        Chuyển đổi HTTPException thành response format chuẩn.
        """
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": f"HTTP_{exc.status_code}",
                    "message": exc.detail,
                    "details": {}
                },
                "request_id": request_id
            }
        )
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """
        Handler cho RequestValidationError - Xử lý validation errors từ Pydantic
        
        Trả về danh sách chi tiết các lỗi validation để frontend hiển thị.
        """
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        content = jsonable_encoder({"detail": exc.errors()})
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Validation error",
                    "details": content.get("detail", [])
                },
                "request_id": request_id
            }
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """
        Handler cho tất cả unhandled exceptions - Xử lý lỗi không mong đợi
        
        Log toàn bộ exception với stack trace và trả về 500 error.
        Không expose chi tiết lỗi cho client (security).
        """
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        logger.error(f"Unhandled exception: {exc}", exc_info=True, extra={"request_id": request_id})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "Internal server error",
                    "details": {"exception": str(exc)} if settings.DEBUG else {}
                },
                "request_id": request_id
            }
        )

