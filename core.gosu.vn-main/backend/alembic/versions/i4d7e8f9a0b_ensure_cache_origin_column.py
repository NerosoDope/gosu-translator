"""Ensure cache.origin column exists (sửa sau khi h3c5d6e7f8a9 đã xóa cột)

Revision ID: i4d7e8f9a0b
Revises: h3c5d6e7f8a9
Create Date: 2026-03-02

"""
from alembic import op
import sqlalchemy as sa


revision = "i4d7e8f9a0b"
down_revision = "h3c5d6e7f8a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Đảm bảo cột origin tồn tại (tránh 500 do model Cache có origin nhưng bảng không có)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'cache' AND column_name = 'origin'
            ) THEN
                ALTER TABLE cache ADD COLUMN origin VARCHAR(50) NULL;
                CREATE INDEX ix_cache_origin ON cache (origin);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_cache_origin;")
    op.execute("ALTER TABLE cache DROP COLUMN IF EXISTS origin;")
