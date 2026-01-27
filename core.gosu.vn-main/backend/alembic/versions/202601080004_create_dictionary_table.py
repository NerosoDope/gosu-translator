"""Create dictionary table
Revision ID: 202601080004
Revises: 202601080003
Create Date: 2026-01-08
"""
revision = '202601080004'
down_revision = '202601080003'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    op.create_table(
        'dictionary',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('code', sa.String(length=64), unique=True, index=True, nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
def downgrade() -> None:
    op.drop_table('dictionary')
