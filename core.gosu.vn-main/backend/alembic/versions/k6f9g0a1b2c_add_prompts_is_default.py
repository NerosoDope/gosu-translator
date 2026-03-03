"""Add prompts.is_default for prompt mặc định

Revision ID: k6f9g0a1b2c
Revises: j5e8f9a0b1c
Create Date: 2026-03-02

"""
from alembic import op
import sqlalchemy as sa


revision = "k6f9g0a1b2c"
down_revision = "j5e8f9a0b1c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "prompts",
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("prompts", "is_default")
