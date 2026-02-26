from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from .service import LanguageService
from .schemas import (
    LanguageCreate, LanguageUpdate, LanguageResponse, LanguageListResponse,
    LanguagePairCreate, LanguagePairUpdate, LanguagePairResponse, LanguagePairListResponse,
    LanguageWithPairsResponse
)
from typing import List, Optional

router = APIRouter(tags=["Languages"])

# Language endpoints
@router.get("", response_model=LanguageListResponse)
async def list_languages(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    query: str = Query("", description="Search by name or code"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    include_deleted: bool = Query(False, description="Include soft deleted records"),
    sort_by: str = Query("id", description="Sort by field"),
    sort_order: str = Query("asc", description="Sort order: asc or desc"),
    db: AsyncSession = Depends(get_db)
):
    service = LanguageService(db)
    if query or is_active is not None:
        result = await service.search_languages(
            query=query,
            is_active=is_active,
            skip=skip,
            limit=limit,
            sort_by=sort_by,
            sort_order=sort_order,
            include_deleted=include_deleted
        )
    else:
        result = await service.list_languages(
            skip=skip,
            limit=limit,
            sort_by=sort_by,
            sort_order=sort_order,
            include_deleted=include_deleted
        )
    return result

# Available targets (must be before /{id} so "available-targets" path is matched)
@router.get("/{source_language_id}/available-targets", response_model=List[LanguageResponse])
@router.get("/{source_language_id}/available-targets/", response_model=List[LanguageResponse])
async def get_available_target_languages(
    source_language_id: int,
    organization_id: Optional[int] = Query(None, description="Organization ID for filtering"),
    db: AsyncSession = Depends(get_db)
):
    service = LanguageService(db)
    return await service.get_available_target_languages(source_language_id, organization_id)

# Language Pairs endpoints (must be before /{id} so "pairs" is not matched as id)
@router.get("/pairs", response_model=LanguagePairListResponse)
@router.get("/pairs/", response_model=LanguagePairListResponse)
async def list_language_pairs(
    source_language_id: Optional[int] = Query(None, description="Filter by source language ID"),
    target_language_id: Optional[int] = Query(None, description="Filter by target language ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    organization_id: Optional[int] = Query(None, description="Filter by organization ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    service = LanguageService(db)
    return await service.list_pairs(
        source_language_id=source_language_id,
        target_language_id=target_language_id,
        is_active=is_active,
        organization_id=organization_id,
        skip=skip,
        limit=limit
    )

@router.get("/pairs/{id}", response_model=LanguagePairResponse)
@router.get("/pairs/{id}/", response_model=LanguagePairResponse)
async def get_language_pair(id: int, db: AsyncSession = Depends(get_db)):
    service = LanguageService(db)
    return await service.get_pair(id)

@router.post("/pairs", response_model=LanguagePairResponse)
@router.post("/pairs/", response_model=LanguagePairResponse)
async def create_language_pair(data: LanguagePairCreate, db: AsyncSession = Depends(get_db)):
    service = LanguageService(db)
    return await service.create_pair(data)

@router.put("/pairs/{id}", response_model=LanguagePairResponse)
@router.put("/pairs/{id}/", response_model=LanguagePairResponse)
async def update_language_pair(id: int, data: LanguagePairUpdate, db: AsyncSession = Depends(get_db)):
    service = LanguageService(db)
    return await service.update_pair(id, data)

@router.delete("/pairs/{id}", response_model=bool)
@router.delete("/pairs/{id}/", response_model=bool)
async def delete_language_pair(id: int, db: AsyncSession = Depends(get_db)):
    service = LanguageService(db)
    return await service.delete_pair(id)

# Single language endpoints (after /pairs so path param doesn't catch "pairs")
@router.get("/{id}", response_model=LanguageWithPairsResponse)
async def get_language(id: int, db: AsyncSession = Depends(get_db)):
    service = LanguageService(db)
    result = await service.get_language_with_pairs_count(id)
    return {
        "id": result["language"].id,
        "code": result["language"].code,
        "name": result["language"].name,
        "is_active": result["language"].is_active,
        "created_at": result["language"].created_at,
        "updated_at": result["language"].updated_at,
        "source_pairs_count": result["source_pairs_count"],
        "target_pairs_count": result["target_pairs_count"]
    }

@router.post("", response_model=LanguageResponse)
async def create_language(data: LanguageCreate, db: AsyncSession = Depends(get_db)):
    service = LanguageService(db)
    return await service.create_language(data)

@router.put("/{id}", response_model=LanguageResponse)
async def update_language(id: int, data: LanguageUpdate, db: AsyncSession = Depends(get_db)):
    service = LanguageService(db)
    return await service.update_language(id, data)

@router.delete("/{id}", response_model=LanguageResponse)
async def soft_delete_language(id: int, db: AsyncSession = Depends(get_db)):
    service = LanguageService(db)
    return await service.soft_delete_language(id)

@router.post("/{id}/restore", response_model=LanguageResponse)
async def restore_language(id: int, db: AsyncSession = Depends(get_db)):
    service = LanguageService(db)
    return await service.restore_language(id)
