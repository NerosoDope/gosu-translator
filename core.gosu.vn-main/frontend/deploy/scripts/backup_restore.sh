#!/bin/bash
# Database backup and restore script

set -e

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

case "$1" in
  backup)
    echo "Creating backup..."
    pg_dump -h postgres -U core_user -d core_db | gzip > "${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz"
    echo "Backup created: backup_${TIMESTAMP}.sql.gz"
    ;;
  restore)
    if [ -z "$2" ]; then
      echo "Usage: $0 restore <backup_file>"
      exit 1
    fi
    echo "Restoring from $2..."
    gunzip -c "$2" | psql -h postgres -U core_user -d core_db
    echo "Restore completed!"
    ;;
  *)
    echo "Usage: $0 {backup|restore} [backup_file]"
    exit 1
    ;;
esac

