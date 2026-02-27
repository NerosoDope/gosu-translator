"""Drop translation_style column from game_category

Revision ID: e3f8a2b1c5d6
Revises: d2e7f8a1b3c4
Create Date: 2026-02-26

"""

from alembic import op
import sqlalchemy as sa


revision = "e3f8a2b1c5d6"
down_revision = "d2e7f8a1b3c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("game_category", "translation_style")


def downgrade() -> None:
    op.add_column(
        "game_category",
        sa.Column("translation_style", sa.String(255), nullable=True),
    )
