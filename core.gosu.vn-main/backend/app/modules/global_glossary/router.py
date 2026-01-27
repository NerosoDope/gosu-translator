"""
Global_Glossary Router - API endpoints

Author: GOSU Development Team
Version: 1.0.0
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.db.session import get_db
from app.modules.global_glossary.schemas import *
from app.modules.global_glossary.service import Global_GlossaryService

router = APIRouter()


@router.get("", response_model=List[Global_GlossaryResponse])
async def list_global_glossary(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """List Global_Glossary - Lấy danh sách"""
    service = Global_GlossaryService(db)
    return await service.list(skip=skip, limit=limit)


@router.get("/{id}", response_model=Global_GlossaryResponse)
async def get_global_glossary(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get Global_Glossary - Lấy chi tiết"""
    service = Global_GlossaryService(db)
    item = await service.get(id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item


@router.post("", response_model=Global_GlossaryResponse, status_code=status.HTTP_201_CREATED)
async def create_global_glossary(
    data: Global_GlossaryCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create Global_Glossary - Tạo mới"""
    service = Global_GlossaryService(db)
    return await service.create(data.model_dump())


@router.put("/{id}", response_model=Global_GlossaryResponse)
async def update_global_glossary(
    id: int,
    data: Global_GlossaryUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update Global_Glossary - Cập nhật"""
    service = Global_GlossaryService(db)
    item = await service.update(id, data.model_dump(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_global_glossary(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete Global_Glossary - Xóa"""
    service = Global_GlossaryService(db)
    success = await service.delete(id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return None
