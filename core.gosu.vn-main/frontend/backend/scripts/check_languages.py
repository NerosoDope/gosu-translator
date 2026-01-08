#!/usr/bin/env python3
"""Quick script to check existing languages"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.session import AsyncSessionLocal
from app.modules.language.repository import LanguageRepository

async def check_languages():
    async with AsyncSessionLocal() as db:
        repo = LanguageRepository(db)
        langs = await repo.list(limit=100)
        print(f"\n📊 Existing languages ({len(langs)}):")
        for lang in langs:
            print(f"  - {lang.code.upper()}: {lang.name} (ID: {lang.id}, Active: {lang.is_active})")
        return langs

if __name__ == "__main__":
    asyncio.run(check_languages())
