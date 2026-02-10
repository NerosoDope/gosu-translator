from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "c1d69596aafb"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Fresh baseline migration.

    NOTE:
        - This migration is intended as a clean baseline that reflects
          the current SQLAlchemy models in `app.modules`.
        - If you already have an existing database that was created
          using the old Alembic history, you should **recreate** that
          database and run `alembic upgrade head` from scratch.
    """

    # --- Core RBAC / users ---
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_organizations_id", "organizations", ["id"], unique=False)
    op.create_index("ix_organizations_code", "organizations", ["code"], unique=True)

    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_roles_id", "roles", ["id"], unique=False)
    op.create_index("ix_roles_code", "roles", ["code"], unique=True)

    op.create_table(
        "permissions",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("module", sa.String(length=50), nullable=True),
        sa.Column("resource", sa.String(length=100), nullable=True),
        sa.Column("action", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_permissions_id", "permissions", ["id"], unique=False)
    op.create_index("ix_permissions_code", "permissions", ["code"], unique=True)
    op.create_index("ix_permissions_module", "permissions", ["module"], unique=False)

    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), primary_key=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("avatar", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("permission_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"]),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.id"]),
        sa.PrimaryKeyConstraint("role_id", "permission_id"),
    )

    op.create_table(
        "user_roles",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("assigned_by", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
    )
    op.create_index("ix_user_roles_id", "user_roles", ["id"], unique=False)
    op.create_index("ix_user_roles_user_id", "user_roles", ["user_id"], unique=False)
    op.create_index("ix_user_roles_role_id", "user_roles", ["role_id"], unique=False)

    # --- Language & dictionary ---
    op.create_table(
        "languages",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_languages_id", "languages", ["id"], unique=False)
    op.create_index("ix_languages_code", "languages", ["code"], unique=True)

    op.create_table(
        "language_pairs",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("source_language_id", sa.Integer(), nullable=False),
        sa.Column("target_language_id", sa.Integer(), nullable=False),
        sa.Column("is_bidirectional", sa.Boolean(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["source_language_id"], ["languages.id"]),
        sa.ForeignKeyConstraint(["target_language_id"], ["languages.id"]),
    )
    op.create_index(
        "ix_language_pairs_source_target",
        "language_pairs",
        ["source_language_id", "target_language_id"],
        unique=False,
    )
    op.create_index(
        "ix_language_pairs_organization", "language_pairs", ["organization_id"], unique=False
    )

    # --- Cache ---
    op.create_table(
        "cache",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("key", sa.String(length=255), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("ttl", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_cache_id", "cache", ["id"], unique=False)
    op.create_index("ix_cache_key", "cache", ["key"], unique=True)

    # --- Game & glossary ---
    op.create_table(
        "game_category",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("translation_style", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_game_category_id", "game_category", ["id"], unique=False)

    op.create_table(
        "games",
        sa.Column("id", sa.BigInteger(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("game_category_id", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["game_category_id"], ["game_category.id"]),
    )
    op.create_index("ix_games_id", "games", ["id"], unique=False)
    op.create_index("ix_games_name", "games", ["name"], unique=False)

    op.create_table(
        "game_glossaries",
        sa.Column("id", sa.BigInteger(), primary_key=True, nullable=False),
        sa.Column("term", sa.String(length=255), nullable=False),
        sa.Column("translated_term", sa.String(length=255), nullable=False),
        sa.Column("language_pair", sa.String(length=50), nullable=False),
        sa.Column("usage_count", sa.Integer(), nullable=True),
        sa.Column("game_id", sa.BigInteger(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"]),
    )
    op.create_index("ix_game_glossaries_id", "game_glossaries", ["id"], unique=False)

    op.create_table(
        "global_glossary",
        sa.Column("id", sa.BigInteger(), primary_key=True, nullable=False),
        sa.Column("term", sa.String(length=255), nullable=False),
        sa.Column("translated_term", sa.String(length=255), nullable=False),
        sa.Column("language_pair", sa.String(length=255), nullable=False),
        sa.Column("game_category_id", sa.Integer(), nullable=True),
        sa.Column("usage_count", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["game_category_id"], ["game_category.id"]),
    )
    op.create_index("ix_global_glossary_id", "global_glossary", ["id"], unique=False)

    # --- Jobs ---
    op.create_table(
        "jobs",
        sa.Column("id", sa.BigInteger(), primary_key=True, nullable=False),
        sa.Column("job_code", sa.String(length=50), nullable=False),
        sa.Column("job_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("team_id", sa.BigInteger(), nullable=True),
        sa.Column("game_id", sa.BigInteger(), nullable=True),
        sa.Column("game_genre", sa.String(length=50), nullable=True),
        sa.Column("source_lang", sa.String(length=10), nullable=True),
        sa.Column("target_lang", sa.String(length=10), nullable=True),
        sa.Column("progress", sa.Integer(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=True),
        sa.Column("max_retry", sa.Integer(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_jobs_id", "jobs", ["id"], unique=False)
    op.create_unique_constraint("uq_jobs_job_code", "jobs", ["job_code"])

    # --- Settings ---
    op.create_table(
        "settings",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("key", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("is_encrypted", sa.Boolean(), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_settings_id", "settings", ["id"], unique=False)
    op.create_index("ix_settings_key", "settings", ["key"], unique=True)
    op.create_index("ix_settings_category", "settings", ["category"], unique=False)

    # --- Prompts ---
    op.create_table(
        "prompts",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("language_code", sa.String(length=16), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_prompts_id", "prompts", ["id"], unique=False)
    op.create_index("ix_prompts_name", "prompts", ["name"], unique=False)

    # --- Audit logs ---
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("module", sa.String(length=50), nullable=False),
        sa.Column("resource_type", sa.String(length=50), nullable=True),
        sa.Column("resource_id", sa.BigInteger(), nullable=True),
        sa.Column("user_id", sa.BigInteger(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_audit_logs_id", "audit_logs", ["id"], unique=False)
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"], unique=False)
    op.create_index("ix_audit_logs_module", "audit_logs", ["module"], unique=False)
    op.create_index("ix_audit_logs_resource_id", "audit_logs", ["resource_id"], unique=False)
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"], unique=False)
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"], unique=False)


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_resource_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_module", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_prompts_name", table_name="prompts")
    op.drop_index("ix_prompts_id", table_name="prompts")
    op.drop_table("prompts")

    op.drop_index("ix_settings_category", table_name="settings")
    op.drop_index("ix_settings_key", table_name="settings")
    op.drop_index("ix_settings_id", table_name="settings")
    op.drop_table("settings")

    op.drop_index("ix_jobs_id", table_name="jobs")
    op.drop_constraint("uq_jobs_job_code", "jobs", type_="unique")
    op.drop_table("jobs")

    op.drop_index("ix_global_glossary_id", table_name="global_glossary")
    op.drop_table("global_glossary")

    op.drop_index("ix_game_glossaries_id", table_name="game_glossaries")
    op.drop_table("game_glossaries")

    op.drop_index("ix_games_name", table_name="games")
    op.drop_index("ix_games_id", table_name="games")
    op.drop_table("games")

    op.drop_index("ix_game_category_id", table_name="game_category")
    op.drop_table("game_category")

    op.drop_index("ix_cache_key", table_name="cache")
    op.drop_index("ix_cache_id", table_name="cache")
    op.drop_table("cache")

    op.drop_index("ix_language_pairs_organization", table_name="language_pairs")
    op.drop_index("ix_language_pairs_source_target", table_name="language_pairs")
    op.drop_table("language_pairs")

    op.drop_index("ix_languages_code", table_name="languages")
    op.drop_index("ix_languages_id", table_name="languages")
    op.drop_table("languages")

    op.drop_index("ix_user_roles_role_id", table_name="user_roles")
    op.drop_index("ix_user_roles_user_id", table_name="user_roles")
    op.drop_index("ix_user_roles_id", table_name="user_roles")
    op.drop_table("user_roles")

    op.drop_table("role_permissions")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")

    op.drop_index("ix_permissions_module", table_name="permissions")
    op.drop_index("ix_permissions_code", table_name="permissions")
    op.drop_index("ix_permissions_id", table_name="permissions")
    op.drop_table("permissions")

    op.drop_index("ix_roles_code", table_name="roles")
    op.drop_index("ix_roles_id", table_name="roles")
    op.drop_table("roles")

    op.drop_index("ix_organizations_code", table_name="organizations")
    op.drop_index("ix_organizations_id", table_name="organizations")
    op.drop_table("organizations")