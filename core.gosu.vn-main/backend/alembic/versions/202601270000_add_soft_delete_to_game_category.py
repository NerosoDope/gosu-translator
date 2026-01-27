"""Add soft delete to game_category

Revision ID: 202601270000
Revises: 202601080006
Create Date: 2026-01-27

"""
revision = '202601270000'
down_revision = '202601080006'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column('game_category', sa.Column('is_deleted', sa.Boolean(), nullable=True, default=False))
    op.add_column('game_category', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('game_category', 'deleted_at')
    op.drop_column('game_category', 'is_deleted')