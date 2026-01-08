"""
Script để kiểm tra kết nối database

Script này kiểm tra xem có thể kết nối được đến database không.
Sử dụng để debug và verify database configuration.
"""

import asyncio
import sys
from pathlib import Path

# Add backend directory to path để import app modules
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import text
from app.db.session import engine, AsyncSessionLocal
from app.core.config import settings


async def test_database_connection():
    """
    Kiểm tra kết nối database
    
    Returns:
        bool: True nếu kết nối thành công, False nếu thất bại
    """
    print("=" * 60)
    print("Testing Database Connection")
    print("=" * 60)
    print(f"Database URL: {settings.DATABASE_URL.split('@')[0]}@...")  # Hide password
    print()
    
    try:
        # Test 1: Kiểm tra engine có thể tạo connection không
        print("Test 1: Testing engine connection...")
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT 1 as test"))
            row = result.fetchone()
            if row and row[0] == 1:
                print("✓ Engine connection: SUCCESS")
            else:
                print("✗ Engine connection: FAILED (unexpected result)")
                return False
        print()
        
        # Test 2: Kiểm tra session có thể query được không
        print("Test 2: Testing session query...")
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✓ Session query: SUCCESS")
            print(f"  PostgreSQL version: {version[:50]}...")
        print()
        
        # Test 3: Kiểm tra có thể query được thông tin database không
        print("Test 3: Testing database info query...")
        async with AsyncSessionLocal() as session:
            # Get current database name
            result = await session.execute(text("SELECT current_database()"))
            db_name = result.scalar()
            print(f"  Current database: {db_name}")
            
            # Get connection count
            result = await session.execute(text("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"))
            conn_count = result.scalar()
            print(f"  Active connections: {conn_count}")
        print()
        
        # Test 4: Kiểm tra các bảng có tồn tại không (nếu đã chạy migrations)
        print("Test 4: Checking for existing tables...")
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name
            """))
            tables = [row[0] for row in result.fetchall()]
            if tables:
                print(f"✓ Found {len(tables)} tables:")
                for table in tables[:10]:  # Show first 10 tables
                    print(f"  - {table}")
                if len(tables) > 10:
                    print(f"  ... and {len(tables) - 10} more")
            else:
                print("⚠ No tables found (migrations may not have been run)")
        print()
        
        print("=" * 60)
        print("✓ ALL TESTS PASSED - Database connection is working!")
        print("=" * 60)
        return True
        
    except Exception as e:
        print()
        print("=" * 60)
        print("✗ DATABASE CONNECTION FAILED")
        print("=" * 60)
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        print()
        print("Possible issues:")
        print("1. Database server is not running")
        print("2. DATABASE_URL in .env file is incorrect")
        print("3. Database credentials are wrong")
        print("4. Network/firewall issues")
        print("5. Database doesn't exist yet")
        print()
        return False
    finally:
        # Close engine connections
        await engine.dispose()


if __name__ == "__main__":
    try:
        result = asyncio.run(test_database_connection())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        sys.exit(1)

