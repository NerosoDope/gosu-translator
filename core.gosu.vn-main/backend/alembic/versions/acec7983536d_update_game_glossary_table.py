"""update_game_glossary_table

Revision ID: acec7983536d
Revises: a444366d585c
Create Date: 2026-01-22 15:34:58.393248

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'acec7983536d'
down_revision = 'a444366d585c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns
    op.add_column('game_glossary', sa.Column('translated_term', sa.String(length=255), nullable=True))
    op.add_column('game_glossary', sa.Column('language_pair', sa.String(length=255), nullable=True))
    op.add_column('game_glossary', sa.Column('usage_count', sa.Integer(), nullable=False, default=0))
    op.add_column('game_glossary', sa.Column('game_id', sa.BigInteger(), sa.ForeignKey('games.id'), nullable=True))

    # Migrate data from old columns to new columns
    # Copy definition to translated_term
    op.execute('UPDATE game_glossary SET translated_term = definition WHERE definition IS NOT NULL')

    # Copy category_id to game_id (keeping as is for now - will need manual mapping if category_id != game_id)
    op.execute('UPDATE game_glossary SET game_id = category_id WHERE category_id IS NOT NULL')

    # Drop old columns
    op.drop_column('game_glossary', 'definition')
    op.drop_column('game_glossary', 'category_id')

    # Make translated_term not nullable after migration
    op.alter_column('game_glossary', 'translated_term', nullable=False)


def downgrade() -> None:
    # Add back old columns
    op.add_column('game_glossary', sa.Column('definition', sa.Text(), nullable=True))
    op.add_column('game_glossary', sa.Column('category_id', sa.Integer(), sa.ForeignKey('game_category.id'), nullable=True))

    # Migrate data back from new columns to old columns
    # Copy translated_term to definition
    op.execute('UPDATE game_glossary SET definition = translated_term WHERE translated_term IS NOT NULL')

    # Copy game_id to category_id
    op.execute('UPDATE game_glossary SET category_id = game_id WHERE game_id IS NOT NULL')

    # Drop new columns
    op.drop_column('game_glossary', 'translated_term')
    op.drop_column('game_glossary', 'language_pair')
    op.drop_column('game_glossary', 'usage_count')
    op.drop_column('game_glossary', 'game_id')

