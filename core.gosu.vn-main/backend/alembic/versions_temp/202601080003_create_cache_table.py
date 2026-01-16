"""Create cache table
Revision ID: 202601080003
Revises: 202601080001
Create Date: 2026-01-08
"""
revision = '202601080003'
down_revision = "202601080002"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    op.create_table(
        'cache',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('key', sa.String(length=255), unique=True, index=True, nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('ttl', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
def downgrade() -> None:
    op.drop_table('cache')
