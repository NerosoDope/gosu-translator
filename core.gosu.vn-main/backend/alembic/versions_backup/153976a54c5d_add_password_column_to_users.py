"""add_password_column_to_users

Revision ID: 153976a54c5d
Revises: e490244b90cb
Create Date: 2026-01-19 04:03:17.576078

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '153976a54c5d'
down_revision = 'e490244b90cb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add password column to users table
    op.add_column('users', sa.Column('password', sa.String(length=255), nullable=True))


def downgrade() -> None:
    # Remove password column from users table
    op.drop_column('users', 'password')

