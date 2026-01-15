"""Create game_glossary table
Revision ID: 202601080007
Revises: 202601080006
Create Date: 2026-01-08
"""
revision = '202601080007'
down_revision = '202601080006'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    op.create_table(
        'game_glossary',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('term', sa.String(length=255), nullable=False),
        sa.Column('definition', sa.Text(), nullable=False),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('game_category.id'), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
def downgrade() -> None:
    op.drop_table('game_glossary')
