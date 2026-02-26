from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from .repository import LanguageRepository
from .schemas import LanguageCreate, LanguageUpdate, LanguagePairCreate, LanguagePairUpdate

class LanguageService:
    def __init__(self, db: AsyncSession):
        self.repo = LanguageRepository(db)

    # Language methods
    async def list_languages(self, skip: int = 0, limit: int = 20, sort_by: str = "id", sort_order: str = "asc", include_deleted: bool = False):
        items = await self.repo.list(skip=skip, limit=limit, sort_by=sort_by, sort_order=sort_order, include_deleted=include_deleted)
        total = await self.repo.count(include_deleted=include_deleted)
        return {
            "items": items,
            "total": total,
            "page": (skip // limit) + 1,
            "per_page": limit,
            "pages": (total + limit - 1) // limit if limit > 0 else 0
        }

    async def search_languages(self, query: str = "", is_active: Optional[bool] = None, skip: int = 0, limit: int = 20, sort_by: str = "id", sort_order: str = "asc", include_deleted: bool = False):
        items = await self.repo.search(query=query, is_active=is_active, skip=skip, limit=limit, sort_by=sort_by, sort_order=sort_order, include_deleted=include_deleted)
        total = await self.repo.count_search(query=query, is_active=is_active, include_deleted=include_deleted)
        return {
            "items": items,
            "total": total,
            "page": (skip // limit) + 1,
            "per_page": limit,
            "pages": (total + limit - 1) // limit if limit > 0 else 0
        }

    async def get_language(self, id: int):
        language = await self.repo.get(id)
        if not language:
            raise HTTPException(status_code=404, detail="Language not found")
        return language

    async def get_name_by_code(self, code: str) -> str:
        """Trả về tên ngôn ngữ theo mã (từ bảng languages). Không tìm thấy thì trả về code."""
        if not (code or "").strip():
            return (code or "").strip()
        lang = await self.repo.get_by_code(code)
        return (lang.name or code).strip() if lang else (code or "").strip()

    async def get_language_with_pairs_count(self, id: int):
        result = await self.repo.get_with_pairs_count(id)
        if not result:
            raise HTTPException(status_code=404, detail="Language not found")
        return result

    async def create_language(self, data: LanguageCreate):
        # Validate ISO 639-1 code format (2 characters)
        if len(data.code) != 2:
            raise HTTPException(status_code=400, detail="Language code must be 2 characters (ISO 639-1)")

        # Check if code already exists
        existing = await self.repo.search(query=data.code)
        if any(lang.code.lower() == data.code.lower() for lang in existing):
            raise HTTPException(status_code=400, detail=f"Language code '{data.code}' already exists")

        try:
            return await self.repo.create(data.dict())
        except Exception as e:
            # Handle database integrity errors (unique constraint violations)
            error_str = str(e).lower()
            if 'duplicate key' in error_str or 'unique constraint' in error_str or 'uniqueviolation' in error_str:
                if 'code' in error_str or 'languages_code_key' in error_str:
                    raise HTTPException(status_code=400, detail=f"Language code '{data.code}' already exists")
            # Re-raise other exceptions
            raise HTTPException(status_code=500, detail=f"Error creating language: {str(e)}")

    async def update_language(self, id: int, data: LanguageUpdate):
        # Validate data
        update_data = data.dict(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No data to update")

        if 'code' in update_data and len(update_data['code']) != 2:
            raise HTTPException(status_code=400, detail="Language code must be 2 characters (ISO 639-1)")

        # Check if code already exists (excluding current language)
        if 'code' in update_data:
            existing = await self.repo.search(query=update_data['code'])
            if any(lang.code.lower() == update_data['code'].lower() and lang.id != id for lang in existing):
                raise HTTPException(status_code=400, detail="Language code already exists")

        language = await self.repo.update(id, update_data)
        if not language:
            raise HTTPException(status_code=404, detail="Language not found")
        return language

    async def soft_delete_language(self, id: int):
        # Check if language exists
        language = await self.repo.get(id)
        if not language:
            raise HTTPException(status_code=404, detail="Language not found")

        if language.is_deleted:
            raise HTTPException(status_code=400, detail="Language is already deleted")

        # Check if language is used in active pairs
        pairs_count = await self.repo.get_with_pairs_count(id)
        if pairs_count and (pairs_count['source_pairs_count'] > 0 or pairs_count['target_pairs_count'] > 0):
            raise HTTPException(
                status_code=400,
                detail="Cannot delete language that is used in active language pairs"
            )

        # Soft delete the language
        from datetime import datetime
        update_data = {
            "is_deleted": True,
            "deleted_at": datetime.utcnow(),
            "is_active": False  # Also deactivate
        }
        updated_language = await self.repo.update(id, update_data)
        if not updated_language:
            raise HTTPException(status_code=404, detail="Language not found")
        return updated_language

    async def restore_language(self, id: int):
        # Check if language exists
        language = await self.repo.get(id)
        if not language:
            raise HTTPException(status_code=404, detail="Language not found")

        if not language.is_deleted:
            raise HTTPException(status_code=400, detail="Language is not deleted")

        # Restore the language
        update_data = {
            "is_deleted": False,
            "deleted_at": None,
            "is_active": True  # Reactivate by default
        }
        updated_language = await self.repo.update(id, update_data)
        if not updated_language:
            raise HTTPException(status_code=404, detail="Language not found")
        return updated_language

    # Language Pair methods
    async def list_pairs(
        self,
        source_language_id: Optional[int] = None,
        target_language_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        organization_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20
    ):
        items = await self.repo.list_pairs(
            source_language_id=source_language_id,
            target_language_id=target_language_id,
            is_active=is_active,
            organization_id=organization_id,
            skip=skip,
            limit=limit
        )
        total = await self.repo.count_pairs(
            source_language_id=source_language_id,
            target_language_id=target_language_id,
            is_active=is_active,
            organization_id=organization_id
        )
        return {
            "items": items,
            "total": total,
            "page": (skip // limit) + 1,
            "per_page": limit,
            "pages": (total + limit - 1) // limit if limit > 0 else 0
        }

    async def get_pair(self, id: int):
        pair = await self.repo.get_pair(id)
        if not pair:
            raise HTTPException(status_code=404, detail="Language pair not found")
        return pair

    async def create_pair(self, data: LanguagePairCreate):
        # Validate source and target are different
        if data.source_language_id == data.target_language_id:
            raise HTTPException(status_code=400, detail="Source and target languages cannot be the same")
        
        try:
            return await self.repo.create_pair(data.dict())
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            # Handle other database errors
            error_str = str(e).lower()
            if 'duplicate key' in error_str or 'unique constraint' in error_str or 'uniqueviolation' in error_str:
                raise HTTPException(status_code=400, detail="Language pair already exists")
            if 'foreign key' in error_str or 'does not exist' in error_str:
                raise HTTPException(status_code=400, detail="One or both languages do not exist")
            raise HTTPException(status_code=500, detail=f"Error creating language pair: {str(e)}")

    async def update_pair(self, id: int, data: LanguagePairUpdate):
        update_data = data.dict(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No data to update")

        # Prevent changing source_language_id and target_language_id when updating
        # Only allow changing is_bidirectional and is_active
        if 'source_language_id' in update_data:
            raise HTTPException(status_code=400, detail="Cannot change source language. Please delete and create a new pair instead.")
        if 'target_language_id' in update_data:
            raise HTTPException(status_code=400, detail="Cannot change target language. Please delete and create a new pair instead.")

        try:
            pair = await self.repo.update_pair(id, update_data)
            if not pair:
                raise HTTPException(status_code=404, detail="Language pair not found")
            return pair
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    async def delete_pair(self, id: int):
        success = await self.repo.delete_pair(id)
        if not success:
            raise HTTPException(status_code=404, detail="Language pair not found")
        return success

    async def get_available_target_languages(self, source_language_id: int, organization_id: Optional[int] = None):
        # Validate source language exists
        await self.get_language(source_language_id)  # Will raise 404 if not found
        return await self.repo.get_available_target_languages(source_language_id, organization_id)
