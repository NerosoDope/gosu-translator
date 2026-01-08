"""
Script để reset ID của bảng language_pairs về bắt đầu từ 1

Script này sẽ reset sequence của bảng language_pairs về 1.
Nếu có dữ liệu trong bảng, ID mới sẽ bắt đầu từ 1 (có thể gây conflict).

Usage:
    docker-compose exec backend python /app/scripts/reset_language_pairs_id.py
    hoặc
    cd backend && python scripts/reset_language_pairs_id.py
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

from sqlalchemy import text
from app.db.session import AsyncSessionLocal


async def reset_language_pairs_id():
    """Reset language_pairs ID sequence to start from 1"""
    async with AsyncSessionLocal() as session:
        try:
            # Reset sequence to 1
            await session.execute(text("SELECT setval('language_pairs_id_seq', 1, false)"))
            await session.commit()
            print("✅ Đã reset ID của bảng language_pairs về bắt đầu từ 1")
            print("⚠️  Lưu ý: Nếu có dữ liệu trong bảng, ID mới sẽ bắt đầu từ 1")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Lỗi khi reset sequence: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(reset_language_pairs_id())
