"""
Script to reset language_pairs table ID sequence to start from 1
This version will reset to 1 regardless of existing data
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.db.session import AsyncSessionLocal


async def reset_language_pairs_id_force():
    """Force reset language_pairs ID sequence to start from 1"""
    async with AsyncSessionLocal() as session:
        try:
            # Reset sequence to 1
            await session.execute(text("SELECT setval('language_pairs_id_seq', 1, false)"))
            await session.commit()
            print("✅ Successfully reset language_pairs ID sequence to start from 1")
            print("⚠️  Note: If there are existing records, this may cause ID conflicts for new records")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error resetting sequence: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(reset_language_pairs_id_force())
