"""
Module Files - Router quản lý file upload/download

Module này cung cấp API endpoints để upload, download và tạo presigned URLs cho files.

Mục đích:
    - Upload files lên MinIO storage
    - Tạo presigned URLs để truy cập files
    - Validate file size và file type

Ngữ cảnh:
    - Sử dụng MinIO làm object storage
    - Files được lưu trong bucket được cấu hình trong settings
    - File size và type được validate trước khi upload

Được sử dụng bởi:
    - Frontend để upload files
    - Các modules khác cần lưu trữ files

Xem thêm:
    - docs/architecture.md cho file storage architecture

Author: GOSU Development Team
Version: 1.0.0
"""

import io

from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.core.config import settings
from minio import Minio
from minio.error import S3Error
import logging
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter()

# Khởi tạo MinIO client
# MinIO client được sử dụng để tương tác với MinIO storage
minio_client = Minio(
    settings.MINIO_ENDPOINT.replace("http://", "").replace("https://", ""),
    access_key=settings.MINIO_ACCESS_KEY,
    secret_key=settings.MINIO_SECRET_KEY,
    secure=settings.MINIO_SECURE
)


def _ensure_bucket_exists():
    """Đảm bảo bucket tồn tại, tạo mới nếu chưa có."""
    if not minio_client.bucket_exists(settings.MINIO_BUCKET_NAME):
        minio_client.make_bucket(settings.MINIO_BUCKET_NAME)
        logger.info(f"Created MinIO bucket: {settings.MINIO_BUCKET_NAME}")


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload file lên MinIO
    
    Endpoint này upload file lên MinIO storage sau khi validate size và type.
    
    Args:
        file: File cần upload
        
    Returns:
        dict: File URL và metadata (filename, size, content_type)
    
    Raises:
        HTTPException: 400 nếu file size vượt quá limit hoặc file type không được phép
        HTTPException: 500 nếu có lỗi khi upload lên MinIO
    """
    try:
        # Validate file size
        file_content = await file.read()
        if len(file_content) > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds maximum {settings.MAX_FILE_SIZE} bytes"
            )
        
        # Validate file type
        if file.content_type not in settings.ALLOWED_FILE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {file.content_type} not allowed"
            )
        
        # Đảm bảo bucket tồn tại
        _ensure_bucket_exists()
        # Upload lên MinIO (dùng BytesIO vì file.read() đã consume stream)
        object_name = f"uploads/{file.filename}"
        minio_client.put_object(
            settings.MINIO_BUCKET_NAME,
            object_name,
            io.BytesIO(file_content),
            length=len(file_content),
            content_type=file.content_type
        )
        
        file_url = f"{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET_NAME}/{object_name}"
        
        return {
            "url": file_url,
            "filename": file.filename,
            "size": len(file_content),
            "content_type": file.content_type
        }
    except S3Error as e:
        logger.error(f"MinIO error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error uploading file"
        )


@router.get("/presign")
async def get_presigned_url(object_name: str, expires_seconds: int = 3600):
    """
    Lấy presigned URL để truy cập file
    
    Endpoint này tạo presigned URL để truy cập file trong MinIO mà không cần authentication.
    URL có thời gian hết hạn để bảo mật.
    
    Args:
        object_name: Tên object trong MinIO
        expires_seconds: Thời gian hết hạn của URL (giây, default: 3600)
        
    Returns:
        dict: Presigned URL
    
    Raises:
        HTTPException: 500 nếu có lỗi khi tạo presigned URL
    """
    try:
        url = minio_client.presigned_get_object(
            settings.MINIO_BUCKET_NAME,
            object_name,
            expires=expires_seconds
        )
        return {"url": url}
    except S3Error as e:
        logger.error(f"MinIO error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating presigned URL"
        )

