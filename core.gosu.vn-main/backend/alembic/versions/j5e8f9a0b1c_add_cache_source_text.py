"""Add cache.source_text for xem chi tiết (nội dung gốc)

Revision ID: j5e8f9a0b1c
Revises: i4d7e8f9a0b
Create Date: 2026-03-02

"""
from alembic import op
import sqlalchemy as sa


revision = "j5e8f9a0b1c"
down_revision = "i4d7e8f9a0b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "cache",
        sa.Column("source_text", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("cache", "source_text")
