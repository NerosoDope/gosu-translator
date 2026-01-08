"""
Pytest Configuration và Fixtures

Module này cung cấp các fixtures và cấu hình chung cho tất cả tests.

Author: GOSU Development Team
Version: 1.0.0
"""

import pytest
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base


@pytest.fixture(scope="function")
async def test_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Fixture tạo test database session
    
    Sử dụng in-memory SQLite database cho testing nhanh.
    Nếu cần test với PostgreSQL thực, có thể override fixture này.
    
    Note: Cần cài đặt aiosqlite để sử dụng fixture này:
    pip install aiosqlite
    """
    try:
        # Tạo in-memory SQLite database cho testing
        test_engine = create_async_engine(
            "sqlite+aiosqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        async_session_maker = async_sessionmaker(
            test_engine, class_=AsyncSession, expire_on_commit=False
        )
        
        async with async_session_maker() as session:
            yield session
        
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        
        await test_engine.dispose()
    except ImportError:
        pytest.skip("aiosqlite not installed, skipping database tests")

