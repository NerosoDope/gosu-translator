"""Add origin column to cache table (direct | file | proofread)

Revision ID: g2b4c5d6e7f8
Revises: f1a2b3c4d5e6
Create Date: 2026-03-02

"""

from alembic import op
import sqlalchemy as sa


revision = "g2b4c5d6e7f8"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "cache",
        sa.Column("origin", sa.String(length=50), nullable=True),
    )
    op.create_index("ix_cache_origin", "cache", ["origin"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_cache_origin", table_name="cache")
    op.drop_column("cache", "origin")
