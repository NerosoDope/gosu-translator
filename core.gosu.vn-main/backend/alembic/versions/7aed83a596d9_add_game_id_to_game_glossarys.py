"""add_game_id_to_game_glossarys

Revision ID: 7aed83a596d9
Revises: fda90613a86f
Create Date: 2026-01-23 16:14:44.181093

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7aed83a596d9'
down_revision = 'fda90613a86f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add game_id column to game_glossarys table
    op.add_column('game_glossarys', sa.Column('game_id', sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        'game_glossarys_game_id_fkey',
        'game_glossarys',
        'games',
        ['game_id'],
        ['id']
    )


def downgrade() -> None:
    # Remove game_id column from game_glossarys table
    op.drop_constraint('game_glossarys_game_id_fkey', 'game_glossarys', type_='foreignkey')
    op.drop_column('game_glossarys', 'game_id')

