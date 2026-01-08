"""add password column to users

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2025-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Thêm cột password vào bảng users
    op.add_column('users', sa.Column('password', sa.String(length=255), nullable=True))


def downgrade() -> None:
    # Xóa cột password
    op.drop_column('users', 'password')









