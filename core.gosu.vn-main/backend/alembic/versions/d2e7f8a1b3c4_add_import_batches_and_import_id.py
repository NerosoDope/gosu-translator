"""Add import_batches table and import_id to glossaries

Revision ID: d2e7f8a1b3c4
Revises: c1d69596aafb
Create Date: 2026-02-13

"""

from alembic import op
import sqlalchemy as sa


revision = "d2e7f8a1b3c4"
down_revision = "c1d69596aafb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create import_batches table
    op.create_table(
        "import_batches",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("game_id", sa.BigInteger(), nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("created_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("error_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("user_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_import_batches_id", "import_batches", ["id"], unique=False)
    op.create_index("ix_import_batches_source_type", "import_batches", ["source_type"], unique=False)

    # Add import_id to global_glossary
    op.add_column("global_glossary", sa.Column("import_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        "fk_global_glossary_import_id",
        "global_glossary",
        "import_batches",
        ["import_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_global_glossary_import_id", "global_glossary", ["import_id"], unique=False)

    # Add import_id to game_glossaries
    op.add_column("game_glossaries", sa.Column("import_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        "fk_game_glossaries_import_id",
        "game_glossaries",
        "import_batches",
        ["import_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_game_glossaries_import_id", "game_glossaries", ["import_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_game_glossaries_import_id", table_name="game_glossaries")
    op.drop_constraint("fk_game_glossaries_import_id", "game_glossaries", type_="foreignkey")
    op.drop_column("game_glossaries", "import_id")

    op.drop_index("ix_global_glossary_import_id", table_name="global_glossary")
    op.drop_constraint("fk_global_glossary_import_id", "global_glossary", type_="foreignkey")
    op.drop_column("global_glossary", "import_id")

    op.drop_index("ix_import_batches_source_type", table_name="import_batches")
    op.drop_index("ix_import_batches_id", table_name="import_batches")
    op.drop_table("import_batches")
