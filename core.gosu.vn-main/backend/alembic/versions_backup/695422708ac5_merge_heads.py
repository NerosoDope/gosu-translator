"""merge heads

Revision ID: 695422708ac5
Revises: acec7983536d, c775177c2fc1
Create Date: 2026-01-23 11:22:55.197619

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '695422708ac5'
down_revision = ('acec7983536d', 'c775177c2fc1')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

