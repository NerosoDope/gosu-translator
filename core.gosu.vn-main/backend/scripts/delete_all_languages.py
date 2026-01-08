# -*- coding: utf-8 -*-
"""
Script để xóa tất cả dữ liệu trong bảng languages

Script này sẽ:
1. Xóa tất cả language_pairs (để tránh lỗi foreign key constraint)
2. Xóa tất cả languages

Usage:
    docker-compose exec backend python /app/scripts/delete_all_languages.py
    hoặc
    cd backend && python scripts/delete_all_languages.py
"""

import asyncio
import sys
from pathlib import Path

# Configure UTF-8 encoding for console output
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Add app directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Database imports
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete

# App imports
from app.core.config import settings
from app.modules.language.models import Language, LanguagePair


async def delete_all_languages():
    """
    Xóa tất cả dữ liệu trong bảng languages và language_pairs
    """
    # Tạo database engine
    engine = create_async_engine(
        settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://").replace("postgresql+psycopg://", "postgresql+asyncpg://"),
        echo=settings.DEBUG,
        future=True,
        pool_pre_ping=True,
    )
    
    # Tạo session factory
    AsyncSessionLocal = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with AsyncSessionLocal() as db:
        try:
            # Đếm số lượng records trước khi xóa
            result = await db.execute(select(Language))
            languages_before = result.scalars().all()
            language_count = len(languages_before)
            
            result = await db.execute(select(LanguagePair))
            pairs_before = result.scalars().all()
            pair_count = len(pairs_before)
            
            print(f"📊 Số lượng languages hiện tại: {language_count}")
            print(f"📊 Số lượng language_pairs hiện tại: {pair_count}")
            
            if language_count == 0 and pair_count == 0:
                print("\nℹ️  Không có dữ liệu nào để xóa!")
                return True
            
            # Xác nhận xóa
            print(f"\n⚠️  Bạn sắp xóa {pair_count} language_pairs và {language_count} languages!")
            print("⚠️  Hành động này không thể hoàn tác!")
            
            # Xóa language_pairs trước (để tránh lỗi foreign key constraint)
            if pair_count > 0:
                print("\n🗑️  Đang xóa language_pairs...")
                await db.execute(delete(LanguagePair))
                await db.flush()
                print(f"  ✅ Đã xóa {pair_count} language_pairs")
            
            # Xóa languages
            if language_count > 0:
                print("\n🗑️  Đang xóa languages...")
                await db.execute(delete(Language))
                await db.flush()
                print(f"  ✅ Đã xóa {language_count} languages")
            
            await db.commit()
            
            print(f"\n✅ Hoàn thành! Đã xóa tất cả dữ liệu trong bảng languages và language_pairs")
            
            return True
            
        except Exception as e:
            print(f"\n❌ Lỗi khi xóa dữ liệu: {e}")
            import traceback
            traceback.print_exc()
            await db.rollback()
            return False
        finally:
            await engine.dispose()


if __name__ == "__main__":
    success = asyncio.run(delete_all_languages())
    sys.exit(0 if success else 1)
