#!/bin/bash
# Initialize database script

set -e

echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h postgres -U core_user -d core_db; do
  sleep 1
done

echo "Database is ready!"

# Run migrations
cd /app
alembic upgrade head

echo "Database initialized successfully!"

