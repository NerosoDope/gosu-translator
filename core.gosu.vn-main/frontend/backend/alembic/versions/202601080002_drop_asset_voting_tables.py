"""Drop assets and votings tables
Revision ID: 202601080002
Revises: 202601080001
Create Date: 2026-01-08
"""
revision = '202601080002'
down_revision = '202601080001'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    op.drop_table('assets')
    op.drop_table('votings')

def downgrade() -> None:
    pass
