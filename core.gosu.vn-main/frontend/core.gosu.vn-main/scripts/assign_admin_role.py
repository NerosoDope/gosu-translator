#!/usr/bin/env python3
"""
Script để gán ADMIN role cho user sau khi login

Usage:
    # Chạy trong backend container
    docker exec deploy-backend-1 python /app/scripts/assign_admin_role.py <email>

Hoặc:
    # Chạy từ host
    cd deploy
    docker-compose exec backend python /app/scripts/assign_admin_role.py <email>
"""

import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

# Add app to path
sys.path.insert(0, '/app')

from app.core.config import settings
from app.modules.users.models import User
from app.modules.rbac.models import Role
from app.modules.rbac.service import RBACService

async def assign_admin_role(email: str):
    """Assign ADMIN role to user by email"""
    # Create database connection - ensure asyncpg driver
    db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://").replace("postgresql+psycopg://", "postgresql+asyncpg://")
    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        # Find user by email
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if not user:
            print(f"❌ User with email '{email}' not found")
            print("   User needs to login first to sync from apis.gosu.vn")
            return False
        
        # Find ADMIN role
        result = await db.execute(select(Role).where(Role.code == "ADMIN"))
        admin_role = result.scalar_one_or_none()
        
        if not admin_role:
            print("❌ ADMIN role not found. Please run setup.py first.")
            return False
        
        # Check if already assigned
        from app.modules.rbac.models import UserRole
        result = await db.execute(
            select(UserRole).where(
                UserRole.user_id == user.id,
                UserRole.role_id == admin_role.id
            )
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            print(f"✓ ADMIN role already assigned to {email}")
            return True
        
        # Assign role
        rbac = RBACService(db)
        await rbac.assign_role(
            user_id=user.id,
            role_id=admin_role.id,
            assigned_by=user.id
        )
        await db.commit()
        
        print(f"✓ Successfully assigned ADMIN role to {email}")
        return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python assign_admin_role.py <email>")
        sys.exit(1)
    
    email = sys.argv[1]
    asyncio.run(assign_admin_role(email))

