#!/bin/bash
# Database migration script

set -e

echo "Running database migrations..."

cd /app/backend
alembic upgrade head

echo "Migrations completed successfully!"

