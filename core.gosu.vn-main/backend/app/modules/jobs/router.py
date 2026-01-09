from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from .service import JobService
from .schemas import JobCreate, JobUpdate, JobResponse
from typing import List

router = APIRouter(tags=["Jobs"])

@router.get("/", response_model=List[JobResponse])
async def list_jobs(skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100), db: AsyncSession = Depends(get_db)):
    service = JobService(db)
    jobs = await service.list(skip=skip, limit=limit)
    return jobs

@router.get("/{id}", response_model=JobResponse)
async def get_job(id: int, db: AsyncSession = Depends(get_db)):
    service = JobService(db)
    job = await service.get(id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.post("/", response_model=JobResponse)
async def create_job(data: JobCreate, db: AsyncSession = Depends(get_db)):
    service = JobService(db)
    return await service.create(data.dict())

@router.put("/{id}", response_model=JobResponse)
async def update_job(id: int, data: JobUpdate, db: AsyncSession = Depends(get_db)):
    service = JobService(db)
    job = await service.update(id, data.dict(exclude_unset=True))
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.delete("/{id}", response_model=bool)
async def delete_job(id: int, db: AsyncSession = Depends(get_db)):
    service = JobService(db)
    result = await service.delete(id)
    if not result:
        raise HTTPException(status_code=404, detail="Job not found")
    return result
