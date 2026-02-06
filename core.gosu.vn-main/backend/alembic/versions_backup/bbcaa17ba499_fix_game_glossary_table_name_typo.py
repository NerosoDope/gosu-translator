"""Fix game_glossary table name typo

Revision ID: bbcaa17ba499
Revises: 5c7227070bf7
Create Date: 2026-01-26 09:01:32.893859

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bbcaa17ba499'
down_revision = '5c7227070bf7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Skip rename since table is already correctly named as game_glossaries
    pass


def downgrade() -> None:
    # Skip revert since table is already correctly named
    pass

