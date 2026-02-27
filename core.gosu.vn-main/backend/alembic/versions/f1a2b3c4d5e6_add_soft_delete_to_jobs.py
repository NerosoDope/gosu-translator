"""Add soft delete (deleted_at, updated_at) to jobs table

Revision ID: f1a2b3c4d5e6
Revises: e3f8a2b1c5d6
Create Date: 2026-02-27

"""

from alembic import op
import sqlalchemy as sa


revision = "f1a2b3c4d5e6"
down_revision = "e3f8a2b1c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "jobs",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_jobs_deleted_at", "jobs", ["deleted_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_jobs_deleted_at", table_name="jobs")
    op.drop_column("jobs", "deleted_at")
    op.drop_column("jobs", "updated_at")
