"""merge alembic heads

Revision ID: a74cf86b60e9
Revises: 202601090001, 4c89f2aac145
Create Date: 2026-01-12 17:07:53.023936

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a74cf86b60e9'
down_revision = ('202601090001', '4c89f2aac145')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

