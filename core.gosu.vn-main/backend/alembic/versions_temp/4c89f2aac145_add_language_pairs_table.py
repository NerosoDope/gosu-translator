"""Add language pairs table

Revision ID: 4c89f2aac145
Revises: 202601080008
Create Date: 2026-01-08 11:34:38.454425

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4c89f2aac145'
down_revision = '202601080008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'language_pairs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('source_language_id', sa.Integer(), sa.ForeignKey('languages.id'), nullable=False),
        sa.Column('target_language_id', sa.Integer(), sa.ForeignKey('languages.id'), nullable=False),
        sa.Column('is_bidirectional', sa.Boolean(), default=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('organization_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Create index for performance
    op.create_index('ix_language_pairs_source_target', 'language_pairs', ['source_language_id', 'target_language_id'])
    op.create_index('ix_language_pairs_organization', 'language_pairs', ['organization_id'])


def downgrade() -> None:
    op.drop_index('ix_language_pairs_organization')
    op.drop_index('ix_language_pairs_source_target')
    op.drop_table('language_pairs')

