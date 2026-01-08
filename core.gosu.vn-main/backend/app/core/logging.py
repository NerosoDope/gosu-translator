"""
Logging Configuration Module

Module này cấu hình structured logging cho toàn bộ ứng dụng.
Sử dụng JSON format để dễ dàng tích hợp với ELK/Loki.

Author: GOSU Development Team
Version: 1.0.0
"""

import logging
import sys
from typing import Optional
from app.core.config import settings


def setup_logging(log_level: Optional[str] = None):
    """
    Setup logging configuration
    
    Args:
        log_level: Log level (DEBUG, INFO, WARNING, ERROR). Default từ settings.DEBUG
    """
    if log_level is None:
        log_level = "DEBUG" if settings.DEBUG else "INFO"
    
    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Set specific loggers
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    
    return logging.getLogger(__name__)

