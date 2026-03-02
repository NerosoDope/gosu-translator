"""Drop cache.origin column (nguồn đã mã hóa trong key)

Revision ID: h3c5d6e7f8a9
Revises: f1a2b3c4d5e6
Create Date: 2026-03-02

"""
from alembic import op
import sqlalchemy as sa


revision = "h3c5d6e7f8a9"
down_revision = "g2b4c5d6e7f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Xóa cột origin và index nếu có (an toàn khi chạy trên DB chưa từng có cột)
    op.execute("DROP INDEX IF EXISTS ix_cache_origin;")
    op.execute("ALTER TABLE cache DROP COLUMN IF EXISTS origin;")


def downgrade() -> None:
    op.add_column("cache", sa.Column("origin", sa.String(50), nullable=True))
    op.create_index("ix_cache_origin", "cache", ["origin"], unique=False)
