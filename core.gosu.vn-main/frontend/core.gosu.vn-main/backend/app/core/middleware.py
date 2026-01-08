"""
Module Middleware - Custom HTTP Middleware

Module này định nghĩa các custom middleware cho FastAPI application.
Middleware được thực thi cho mọi HTTP request.

Mục đích:
    - Thêm request ID vào mỗi request để tracking
    - Đo thời gian xử lý request (process time)
    - Log tất cả requests và responses

Ngữ cảnh:
    - Request ID được tạo bằng UUID và trả về trong response header
    - Process time được tính từ khi nhận request đến khi trả response
    - Logs bao gồm method, path, status code, và process time

Được sử dụng bởi:
    - Tất cả HTTP requests đến API
    - Exception handlers để log errors với request ID

Xem thêm:
    - docs/architecture.md cho middleware flow

Author: GOSU Development Team
Version: 1.0.0
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import time
import logging
import uuid

logger = logging.getLogger(__name__)


def setup_middleware(app):
    """
    Setup custom middleware cho FastAPI application
    
    Args:
        app: FastAPI application instance
    """
    
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        """
        Middleware: Thêm request_id vào request state
        
        Mỗi request được gán một UUID duy nhất để tracking và debugging.
        Request ID được trả về trong response header "X-Request-ID".
        """
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
    
    @app.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        """
        Middleware: Thêm X-Process-Time header
        
        Đo thời gian xử lý request (từ khi nhận request đến khi trả response).
        Thời gian được trả về trong response header "X-Process-Time" (giây).
        """
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        return response
    
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        """
        Middleware: Log tất cả requests và responses
        
        Log thông tin về mỗi request (method, path, client IP) và response (status code, process time).
        Sử dụng structured logging với request ID để dễ tracking.
        """
        request_id = getattr(request.state, "request_id", "unknown")
        start_time = time.time()
        
        logger.info(
            f"Request: {request.method} {request.url.path}",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "client": request.client.host if request.client else None
            }
        )
        
        response = await call_next(request)
        process_time = time.time() - start_time
        
        logger.info(
            f"Response: {request.method} {request.url.path} - {response.status_code} ({process_time:.3f}s)",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "process_time": process_time
            }
        )
        
        return response

