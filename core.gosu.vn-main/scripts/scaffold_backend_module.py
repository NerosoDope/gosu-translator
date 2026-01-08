#!/usr/bin/env python3
"""
Backend Module Scaffolding Script

Tạo module mới với cấu trúc chuẩn:
- router.py (API endpoints)
- service.py (Business logic)
- repository.py (Data access)
- schemas.py (Pydantic schemas)
- models.py (SQLAlchemy models)
- Migration file (Alembic)

Usage:
    python scripts/scaffold_backend_module.py --name asset
    python scripts/scaffold_backend_module.py --name voting --with-model
"""

import argparse
import os
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"
MODULES_DIR = BACKEND_DIR / "app" / "modules"


def create_module_structure(module_name: str, with_model: bool = False):
    """Tạo cấu trúc module mới"""
    module_dir = MODULES_DIR / module_name
    module_dir.mkdir(exist_ok=True)
    
    # Router
    router_content = f'''"""
{module_name.title()} Router - API endpoints

Author: GOSU Development Team
Version: 1.0.0
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.db.session import get_db
from app.modules.{module_name}.schemas import *
from app.modules.{module_name}.service import {module_name.title()}Service

router = APIRouter()


@router.get("", response_model=List[dict])
async def list_{module_name}(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """List {module_name.title()} - Lấy danh sách"""
    service = {module_name.title()}Service(db)
    return await service.list(skip=skip, limit=limit)


@router.get("/{{id}}", response_model=dict)
async def get_{module_name}(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get {module_name.title()} - Lấy chi tiết"""
    service = {module_name.title()}Service(db)
    item = await service.get(id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_{module_name}(
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Create {module_name.title()} - Tạo mới"""
    service = {module_name.title()}Service(db)
    return await service.create(data)


@router.put("/{{id}}", response_model=dict)
async def update_{module_name}(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Update {module_name.title()} - Cập nhật"""
    service = {module_name.title()}Service(db)
    item = await service.update(id, data)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item


@router.delete("/{{id}}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_{module_name}(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete {module_name.title()} - Xóa"""
    service = {module_name.title()}Service(db)
    success = await service.delete(id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return None
'''
    
    # Service
    service_content = f'''"""
{module_name.title()} Service - Business logic

Author: GOSU Development Team
Version: 1.0.0
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.{module_name}.repository import {module_name.title()}Repository


class {module_name.title()}Service:
    """{module_name.title()} Service - Business logic cho {module_name}"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = {module_name.title()}Repository(db)
    
    async def list(self, skip: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
        """List {module_name}"""
        return await self.repo.list(skip=skip, limit=limit)
    
    async def get(self, id: int) -> Optional[Dict[str, Any]]:
        """Get {module_name} by ID"""
        return await self.repo.get(id)
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create {module_name}"""
        return await self.repo.create(data)
    
    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update {module_name}"""
        return await self.repo.update(id, data)
    
    async def delete(self, id: int) -> bool:
        """Delete {module_name}"""
        return await self.repo.delete(id)
'''
    
    # Repository
    repository_content = f'''"""
{module_name.title()} Repository - Data access layer

Author: GOSU Development Team
Version: 1.0.0
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
# from app.modules.{module_name}.models import {module_name.title()}  # TODO: Import model when created


class {module_name.title()}Repository:
    """{module_name.title()} Repository - Data access cho {module_name}"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def list(self, skip: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
        """List {module_name}"""
        # TODO: Implement when model is created
        # query = select({module_name.title()}).offset(skip).limit(limit)
        # result = await self.db.execute(query)
        # items = result.scalars().all()
        # return [item.to_dict() for item in items]
        return []
    
    async def get(self, id: int) -> Optional[Dict[str, Any]]:
        """Get {module_name} by ID"""
        # TODO: Implement when model is created
        # result = await self.db.execute(select({module_name.title()}).where({module_name.title()}.id == id))
        # item = result.scalar_one_or_none()
        # return item.to_dict() if item else None
        return None
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create {module_name}"""
        # TODO: Implement when model is created
        # item = {module_name.title()}(**data)
        # self.db.add(item)
        # await self.db.commit()
        # await self.db.refresh(item)
        # return item.to_dict()
        return {{}}
    
    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update {module_name}"""
        # TODO: Implement when model is created
        # result = await self.db.execute(select({module_name.title()}).where({module_name.title()}.id == id))
        # item = result.scalar_one_or_none()
        # if not item:
        #     return None
        # for key, value in data.items():
        #     setattr(item, key, value)
        # await self.db.commit()
        # await self.db.refresh(item)
        # return item.to_dict()
        return None
    
    async def delete(self, id: int) -> bool:
        """Delete {module_name}"""
        # TODO: Implement when model is created
        # result = await self.db.execute(select({module_name.title()}).where({module_name.title()}.id == id))
        # item = result.scalar_one_or_none()
        # if not item:
        #     return False
        # await self.db.delete(item)
        # await self.db.commit()
        # return True
        return False
'''
    
    # Schemas
    schemas_content = f'''"""
{module_name.title()} Schemas - Pydantic schemas

Author: GOSU Development Team
Version: 1.0.0
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class {module_name.title()}Base(BaseModel):
    """Base schema cho {module_name}"""
    # TODO: Add fields
    pass


class {module_name.title()}Create({module_name.title()}Base):
    """Schema để tạo {module_name} mới"""
    pass


class {module_name.title()}Update(BaseModel):
    """Schema để cập nhật {module_name}"""
    # TODO: Add optional fields
    pass


class {module_name.title()}Response({module_name.title()}Base):
    """Schema response cho {module_name}"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
'''
    
    # Models (if with_model)
    models_content = f'''"""
{module_name.title()} Models - SQLAlchemy models

Author: GOSU Development Team
Version: 1.0.0
"""

from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Text, Boolean
from sqlalchemy.sql import func
from app.db.base import Base


class {module_name.title()}(Base):
    """{module_name.title()} Model"""
    __tablename__ = "{module_name}s"
    
    id = Column(BigInteger, primary_key=True, index=True)
    # TODO: Add fields
    name = Column(String(255), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<{module_name.title()}(id={{self.id}}, name={{self.name}})>"
    
    def to_dict(self):
        """Convert to dict"""
        return {{
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }}
'''
    
    # __init__.py
    init_content = f'''# {module_name.title()} Module
from app.modules.{module_name}.router import router

__all__ = ["router"]
'''
    
    # Write files
    (module_dir / "router.py").write_text(router_content,encoding='utf-8')
    (module_dir / "service.py").write_text(service_content,encoding='utf-8')
    (module_dir / "repository.py").write_text(repository_content,encoding='utf-8')
    (module_dir / "schemas.py").write_text(schemas_content,encoding='utf-8')
    (module_dir / "__init__.py").write_text(init_content,encoding='utf-8')
    
    if with_model:
        (module_dir / "models.py").write_text(models_content,encoding='utf-8')
    
    print(f"✅ Module '{module_name}' created successfully!")
    print(f"📁 Location: {module_dir}")
    print(f"\n📝 Next steps:")
    print(f"1. Update models.py (if created) with your fields")
    print(f"2. Update schemas.py with your Pydantic models")
    print(f"3. Implement repository methods")
    print(f"4. Add router to main.py: app.include_router({module_name}_router, prefix=\"/api/v1/{module_name}\", tags=[\"{module_name}\"])")
    if with_model:
        print(f"5. Create migration: cd backend && alembic revision --autogenerate -m \"Add {module_name} module\"")


def main():
    parser = argparse.ArgumentParser(description="Scaffold backend module")
    parser.add_argument("--name", required=True, help="Module name (e.g., asset, voting)")
    parser.add_argument("--with-model", action="store_true", help="Create model file")
    
    args = parser.parse_args()
    
    module_name = args.name.lower().replace("-", "_")
    
    if not module_name.isidentifier():
        print(f"Error: '{module_name}' is not a valid module name")
        return
    
    create_module_structure(module_name, args.with_model)


if __name__ == "__main__":
    main()

