"""Create languages table
Revision ID: 202601080008
Revises: 202601080007
Create Date: 2026-01-08
"""
revision = '202601080008'
down_revision = '202601080007'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    op.create_table(
        'languages',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('code', sa.String(length=16), unique=True, nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
def downgrade() -> None:
    op.drop_table('languages')
