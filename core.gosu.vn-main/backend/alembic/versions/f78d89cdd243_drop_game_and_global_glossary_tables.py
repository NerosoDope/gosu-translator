"""drop_game_and_global_glossary_tables

Revision ID: f78d89cdd243
Revises: 5e82a3cd7885
Create Date: 2026-01-23 16:56:57.829211

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f78d89cdd243'
down_revision = '5e82a3cd7885'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop game_glossary table
    op.drop_index('ix_game_glossary_id', table_name='game_glossary')
    op.drop_table('game_glossary')

    # Drop global_glossarys table
    op.drop_index('ix_global_glossarys_id', table_name='global_glossarys')
    op.drop_table('global_glossarys')


def downgrade() -> None:
    # Recreate global_glossarys table
    op.create_table('global_glossarys',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('term', sa.String(length=255), nullable=False),
        sa.Column('translation_term', sa.String(length=255), nullable=False),
        sa.Column('language_pair', sa.String(length=10), nullable=False),
        sa.Column('game_category_id', sa.Integer(), nullable=False),
        sa.Column('usage_count', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['game_category_id'], ['game_category.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_global_glossarys_id', 'global_glossarys', ['id'], unique=False)

    # Recreate game_glossary table
    op.create_table('game_glossary',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('translated_term', sa.String(length=255), nullable=False),
        sa.Column('language_pair', sa.String(length=255), nullable=True),
        sa.Column('usage_count', sa.Integer(), nullable=True),
        sa.Column('game_id', sa.BigInteger(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['game_id'], ['games.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_game_glossary_id', 'game_glossary', ['id'], unique=False)

