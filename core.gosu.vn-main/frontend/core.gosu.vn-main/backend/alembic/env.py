"""
Alembic Environment Configuration

Author: GOSU Development Team
Version: 1.0.0
"""

from logging.config import fileConfig
from sqlalchemy import engine_from_config, create_engine
from sqlalchemy import pool
from alembic import context
from urllib.parse import urlparse, quote_plus
from app.core.config import settings
from app.db.base import Base

# Import all models để Alembic có thể detect
from app.modules.rbac.models import Role, Permission, UserRole, Organization
from app.modules.users.models import User
from app.modules.audit.models import AuditLog
from app.modules.settings.models import Setting

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    # Build sync URL for offline mode
    database_url = settings.DATABASE_URL
    database_url = database_url.replace("postgresql+asyncpg://", "postgresql://")
    database_url = database_url.replace("postgresql+psycopg://", "postgresql://")
    database_url = database_url.replace("postgresql+psycopg2://", "postgresql://")
    
    parsed = urlparse(database_url)
    encoded_password = quote_plus(parsed.password or '')
    sync_url = f"postgresql+psycopg2://{parsed.username}:{encoded_password}@{parsed.hostname}:{parsed.port or 5432}{parsed.path}"
    
    context.configure(
        url=sync_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # Build sync URL directly from settings to avoid ConfigParser interpolation issues
    database_url = settings.DATABASE_URL
    # Convert to psycopg2 for sync operations
    database_url = database_url.replace("postgresql+asyncpg://", "postgresql://")
    database_url = database_url.replace("postgresql+psycopg://", "postgresql://")
    database_url = database_url.replace("postgresql+psycopg2://", "postgresql://")
    
    parsed = urlparse(database_url)
    # Password from urlparse is already decoded, re-encode it properly
    encoded_password = quote_plus(parsed.password or '')
    sync_url = f"postgresql+psycopg2://{parsed.username}:{encoded_password}@{parsed.hostname}:{parsed.port or 5432}{parsed.path}"
    
    # Create engine directly with sync URL to avoid ConfigParser issues
    connectable = create_engine(sync_url, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
