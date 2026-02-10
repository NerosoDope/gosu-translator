from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.db.session import get_db
from .service import PromptsService
from .schemas import PromptCreate, PromptUpdate, PromptResponse, PromptListResponse
from typing import List

router = APIRouter(prefix="", tags=["Prompts"])


@router.get("/", response_model=PromptListResponse)
async def list_prompts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    query: Optional[str] = Query(None, alias="query"),
    is_active: Optional[bool] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("asc"),
    db: AsyncSession = Depends(get_db),
):
    service = PromptsService(db)
    return await service.list(
        skip=skip,
        limit=limit,
        query=query,
        is_active=is_active,
        sort_by=sort_by,
        sort_order=sort_order or "asc",
    )

@router.get("/{id}", response_model=PromptResponse)
async def get_prompt(id: int, db: AsyncSession = Depends(get_db)):
    service = PromptsService(db)
    item = await service.get(id)
    if not item:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return item

@router.post("/", response_model=PromptResponse)
async def create_prompt(data: PromptCreate, db: AsyncSession = Depends(get_db)):
    service = PromptsService(db)
    return await service.create(data.model_dump())

@router.put("/{id}", response_model=PromptResponse)
async def update_prompt(id: int, data: PromptUpdate, db: AsyncSession = Depends(get_db)):
    service = PromptsService(db)
    item = await service.update(id, data.model_dump(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return item

@router.delete("/{id}", response_model=bool)
async def delete_prompt(id: int, db: AsyncSession = Depends(get_db)):
    service = PromptsService(db)
    result = await service.delete(id)
    if not result:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return result
