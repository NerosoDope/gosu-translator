"""add soft delete fields to languages

Revision ID: 202601090001
Revises: 4c89f2aac145
Create Date: 2026-01-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '202601090001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add soft delete fields to languages table
    op.add_column('languages', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('languages', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # Remove soft delete fields from languages table
    op.drop_column('languages', 'deleted_at')
    op.drop_column('languages', 'is_deleted')