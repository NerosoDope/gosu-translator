"""
Glossary_Entries Router - API endpoints

Author: GOSU Development Team
Version: 1.0.0
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.db.session import get_db
from app.modules.glossary_entries.schemas import *
from app.modules.glossary_entries.service import Glossary_EntriesService

router = APIRouter()


@router.get("", response_model=List[dict])
async def list_glossary_entries(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """List Glossary_Entries - Lấy danh sách"""
    service = Glossary_EntriesService(db)
    return await service.list(skip=skip, limit=limit)


@router.get("/{id}", response_model=dict)
async def get_glossary_entries(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get Glossary_Entries - Lấy chi tiết"""
    service = Glossary_EntriesService(db)
    item = await service.get(id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_glossary_entries(
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Create Glossary_Entries - Tạo mới"""
    service = Glossary_EntriesService(db)
    return await service.create(data)


@router.put("/{id}", response_model=dict)
async def update_glossary_entries(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Update Glossary_Entries - Cập nhật"""
    service = Glossary_EntriesService(db)
    item = await service.update(id, data)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_glossary_entries(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete Glossary_Entries - Xóa"""
    service = Glossary_EntriesService(db)
    success = await service.delete(id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return None
