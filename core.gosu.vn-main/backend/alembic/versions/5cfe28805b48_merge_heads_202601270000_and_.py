"""merge heads 202601270000 and bbcaa17ba499

Revision ID: 5cfe28805b48
Revises: 202601270000, bbcaa17ba499
Create Date: 2026-01-26 17:30:01.661526

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5cfe28805b48'
down_revision = ('202601270000', 'bbcaa17ba499')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

