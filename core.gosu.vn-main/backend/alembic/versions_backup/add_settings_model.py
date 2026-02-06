"""add settings model

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2025-12-29 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tạo settings table
    op.create_table(
        'settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=255), nullable=False),
        sa.Column('category', sa.Enum('GENERAL', 'EMAIL', 'SECURITY', 'SYSTEM', 'INTEGRATION', 'NOTIFICATION', name='settingcategory', native_enum=False), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('type', sa.Enum('STRING', 'INTEGER', 'BOOLEAN', 'JSON', 'TEXT', name='settingtype', native_enum=False), nullable=False),
        sa.Column('is_encrypted', sa.Boolean(), nullable=False),
        sa.Column('is_public', sa.Boolean(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('meta', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Tạo indexes
    op.create_index(op.f('ix_settings_id'), 'settings', ['id'], unique=False)
    op.create_index(op.f('ix_settings_key'), 'settings', ['key'], unique=True)
    op.create_index(op.f('ix_settings_category'), 'settings', ['category'], unique=False)


def downgrade() -> None:
    # Xóa indexes
    op.drop_index(op.f('ix_settings_category'), table_name='settings')
    op.drop_index(op.f('ix_settings_key'), table_name='settings')
    op.drop_index(op.f('ix_settings_id'), table_name='settings')
    
    # Xóa table
    op.drop_table('settings')
    
    # Xóa enums
    op.execute('DROP TYPE IF EXISTS settingtype')
    op.execute('DROP TYPE IF EXISTS settingcategory')

