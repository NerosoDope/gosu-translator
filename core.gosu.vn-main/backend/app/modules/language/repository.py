from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload
from .models import Language, LanguagePair

class LanguageRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, skip: int = 0, limit: int = 20, sort_by: str = "id", sort_order: str = "asc", include_deleted: bool = False) -> List[Language]:
        # Build sort column
        sort_column = None
        if sort_by == "id":
            sort_column = Language.id
        elif sort_by == "code":
            sort_column = Language.code
        elif sort_by == "name":
            sort_column = Language.name
        elif sort_by == "is_active":
            sort_column = Language.is_active
        else:
            sort_column = Language.id

        # Get languages with sorting and optional soft delete filter
        query = select(Language)

        # Exclude deleted records by default unless explicitly requested
        if not include_deleted:
            query = query.where(Language.is_deleted.is_(False))

        # Apply sorting
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        languages = result.scalars().all()

        # Calculate counts for each language
        for language in languages:
            # Count source pairs
            source_query = select(func.count()).select_from(LanguagePair).where(LanguagePair.source_language_id == language.id)
            source_result = await self.db.execute(source_query)
            language.source_pairs_count = source_result.scalar() or 0

            # Count target pairs
            target_query = select(func.count()).select_from(LanguagePair).where(LanguagePair.target_language_id == language.id)
            target_result = await self.db.execute(target_query)
            language.target_pairs_count = target_result.scalar() or 0

        return languages

    async def count(self, include_deleted: bool = False) -> int:
        query = select(func.count()).select_from(Language)
        if not include_deleted:
            query = query.where(Language.is_deleted.is_(False))
        result = await self.db.execute(query)
        return result.scalar()

    async def count_search(self, query: str = "", is_active: Optional[bool] = None, include_deleted: bool = False) -> int:
        search_query = select(func.count()).select_from(Language)
        conditions = []
        if query:
            conditions.append(
                or_(
                    Language.code.ilike(f"%{query}%"),
                    Language.name.ilike(f"%{query}%")
                )
            )
        if is_active is not None:
            conditions.append(Language.is_active == is_active)
        if not include_deleted:
            conditions.append(Language.is_deleted.is_(False))
        if conditions:
            search_query = search_query.where(and_(*conditions))
        result = await self.db.execute(search_query)
        return result.scalar()

    async def get(self, id: int) -> Optional[Language]:
        result = await self.db.execute(select(Language).where(Language.id == id))
        return result.scalar_one_or_none()

    async def get_by_code(self, code: str) -> Optional[Language]:
        if not (code or "").strip():
            return None
        c = (code or "").strip()[:16]
        result = await self.db.execute(
            select(Language).where(and_(Language.code.ilike(c), Language.is_deleted.is_(False)))
        )
        return result.scalar_one_or_none()

    async def create(self, data: Dict[str, Any]) -> Language:
        try:
            item = Language(**data)
            self.db.add(item)
            await self.db.commit()
            await self.db.refresh(item)
            return item
        except Exception as e:
            await self.db.rollback()
            # Re-raise exception for service layer to handle
            raise

    async def update(self, id: int, data: Dict[str, Any]) -> Optional[Language]:
        result = await self.db.execute(select(Language).where(Language.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return None
        for key, value in data.items():
            setattr(item, key, value)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def delete(self, id: int) -> bool:
        result = await self.db.execute(select(Language).where(Language.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True

    async def search(self, query: str = "", is_active: Optional[bool] = None, skip: int = 0, limit: int = 20, sort_by: str = "id", sort_order: str = "asc", include_deleted: bool = False) -> List[Language]:
        """Search languages by name or code"""
        conditions = []
        if query:
            conditions.append(or_(Language.name.ilike(f"%{query}%"), Language.code.ilike(f"%{query}%")))
        if is_active is not None:
            conditions.append(Language.is_active == is_active)

        # Build sort column
        sort_column = None
        if sort_by == "id":
            sort_column = Language.id
        elif sort_by == "code":
            sort_column = Language.code
        elif sort_by == "name":
            sort_column = Language.name
        elif sort_by == "is_active":
            sort_column = Language.is_active
        else:
            sort_column = Language.id

        stmt = select(Language)

        # Exclude deleted records by default unless explicitly requested
        if not include_deleted:
            conditions.append(Language.is_deleted.is_(False))

        if conditions:
            stmt = stmt.where(and_(*conditions))

        # Apply sorting
        if sort_order == "desc":
            stmt = stmt.order_by(sort_column.desc())
        else:
            stmt = stmt.order_by(sort_column.asc())
        stmt = stmt.offset(skip).limit(limit)

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_with_pairs_count(self, id: int) -> Optional[Dict[str, Any]]:
        """Get language with count of source and target pairs"""
        # Count source pairs
        source_count_stmt = select(func.count(LanguagePair.id)).where(
            and_(LanguagePair.source_language_id == id, LanguagePair.is_active == True)
        )
        source_result = await self.db.execute(source_count_stmt)
        source_count = source_result.scalar() or 0

        # Count target pairs
        target_count_stmt = select(func.count(LanguagePair.id)).where(
            and_(LanguagePair.target_language_id == id, LanguagePair.is_active == True)
        )
        target_result = await self.db.execute(target_count_stmt)
        target_count = target_result.scalar() or 0

        # Get language
        language = await self.get(id)
        if not language:
            return None

        return {
            "language": language,
            "source_pairs_count": source_count,
            "target_pairs_count": target_count
        }

    # Language Pair methods
    async def list_pairs(
        self,
        source_language_id: Optional[int] = None,
        target_language_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        organization_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[LanguagePair]:
        """List language pairs with filtering"""
        conditions = []
        if source_language_id:
            conditions.append(LanguagePair.source_language_id == source_language_id)
        if target_language_id:
            conditions.append(LanguagePair.target_language_id == target_language_id)
        if is_active is not None:
            conditions.append(LanguagePair.is_active == is_active)
        if organization_id is not None:
            conditions.append(LanguagePair.organization_id == organization_id)

        stmt = select(LanguagePair).options(
            selectinload(LanguagePair.source_language),
            selectinload(LanguagePair.target_language)
        )
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.offset(skip).limit(limit).order_by(LanguagePair.created_at.desc())

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_pair(self, id: int) -> Optional[LanguagePair]:
        """Get language pair by ID with related languages"""
        stmt = select(LanguagePair).options(
            selectinload(LanguagePair.source_language),
            selectinload(LanguagePair.target_language)
        ).where(LanguagePair.id == id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_pair(self, data: Dict[str, Any]) -> LanguagePair:
        """Create new language pair"""
        # Validate source and target are different
        if data['source_language_id'] == data['target_language_id']:
            raise ValueError("Source and target languages cannot be the same")
        
        # Check if pair already exists (to prevent duplicates)
        existing = await self.db.execute(
            select(LanguagePair).where(
                and_(
                    LanguagePair.source_language_id == data['source_language_id'],
                    LanguagePair.target_language_id == data['target_language_id']
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("Language pair already exists")

        try:
            item = LanguagePair(**data)
            self.db.add(item)
            await self.db.commit()
            await self.db.refresh(item)
            # Reload with relationships for response serialization
            stmt = select(LanguagePair).options(
                selectinload(LanguagePair.source_language),
                selectinload(LanguagePair.target_language)
            ).where(LanguagePair.id == item.id)
            result = await self.db.execute(stmt)
            return result.scalar_one()
        except Exception as e:
            await self.db.rollback()
            # Check if it's a unique constraint violation
            error_str = str(e).lower()
            if 'duplicate key' in error_str or 'unique constraint' in error_str or 'uniqueviolation' in error_str:
                raise ValueError("Language pair already exists")
            # Check for foreign key constraint (language doesn't exist)
            if 'foreign key' in error_str or 'does not exist' in error_str:
                raise ValueError("One or both languages do not exist")
            # Re-raise other exceptions
            raise

    async def update_pair(self, id: int, data: Dict[str, Any]) -> Optional[LanguagePair]:
        """Update language pair"""
        result = await self.db.execute(select(LanguagePair).where(LanguagePair.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return None

        # Check for duplicate if source/target languages are being changed
        if 'source_language_id' in data or 'target_language_id' in data:
            new_source = data.get('source_language_id', item.source_language_id)
            new_target = data.get('target_language_id', item.target_language_id)
            existing = await self.db.execute(
                select(LanguagePair).where(
                    and_(
                        LanguagePair.source_language_id == new_source,
                        LanguagePair.target_language_id == new_target,
                        LanguagePair.id != id
                    )
                )
            )
            if existing.scalar_one_or_none():
                raise ValueError("Language pair already exists")

        for key, value in data.items():
            setattr(item, key, value)
        await self.db.commit()
        await self.db.refresh(item)
        # Reload with relationships for response serialization
        stmt = select(LanguagePair).options(
            selectinload(LanguagePair.source_language),
            selectinload(LanguagePair.target_language)
        ).where(LanguagePair.id == item.id)
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def delete_pair(self, id: int) -> bool:
        """Delete language pair"""
        result = await self.db.execute(select(LanguagePair).where(LanguagePair.id == id))
        item = result.scalar_one_or_none()
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True

    async def get_available_target_languages(self, source_language_id: int, organization_id: Optional[int] = None) -> List[Language]:
        """Get languages that can be used as targets for a source language"""
        # Get all active languages except the source language
        conditions = [Language.is_active == True, Language.id != source_language_id]

        stmt = select(Language).where(and_(*conditions))
        result = await self.db.execute(stmt)
        all_languages = result.scalars().all()

        # Get existing pairs for this source language
        pairs_stmt = select(LanguagePair.target_language_id).where(
            and_(
                LanguagePair.source_language_id == source_language_id,
                LanguagePair.is_active == True
            )
        )
        if organization_id is not None:
            pairs_stmt = pairs_stmt.where(
                or_(LanguagePair.organization_id == organization_id, LanguagePair.organization_id.is_(None))
            )

        pairs_result = await self.db.execute(pairs_stmt)
        existing_targets = {row[0] for row in pairs_result.all()}

        # Filter out languages that already have pairs
        available_languages = [lang for lang in all_languages if lang.id not in existing_targets]

        return available_languages

    async def count_pairs(
        self,
        source_language_id: Optional[int] = None,
        target_language_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        organization_id: Optional[int] = None
    ) -> int:
        pairs_stmt = select(func.count()).select_from(LanguagePair)

        conditions = []
        if source_language_id is not None:
            conditions.append(LanguagePair.source_language_id == source_language_id)
        if target_language_id is not None:
            conditions.append(LanguagePair.target_language_id == target_language_id)
        if is_active is not None:
            conditions.append(LanguagePair.is_active == is_active)
        if organization_id is not None:
            conditions.append(
                or_(LanguagePair.organization_id == organization_id, LanguagePair.organization_id.is_(None))
            )

        if conditions:
            pairs_stmt = pairs_stmt.where(and_(*conditions))

        result = await self.db.execute(pairs_stmt)
        return result.scalar()
