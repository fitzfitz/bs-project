#!/usr/bin/env bash
# Database Restore Script for The Barber Project
#
# Usage: ./scripts/restore-db.sh <backup-file.sql.gz>

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lh "${BACKUP_DIR:-/var/backups/barber-db}"/barber_*.sql.gz 2>/dev/null || echo "  No backups found in ${BACKUP_DIR:-/var/backups/barber-db}"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: File not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "[restore] WARNING: This will overwrite the current database!"
echo "[restore] Restoring from: $BACKUP_FILE"
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "[restore] Cancelled."
  exit 0
fi

if [ -n "${DATABASE_URL:-}" ]; then
  gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"
else
  PGHOST="${PGHOST:-localhost}"
  PGPORT="${PGPORT:-5432}"
  PGUSER="${PGUSER:-postgres}"
  PGDATABASE="${PGDATABASE:-barber-project}"
  gunzip -c "$BACKUP_FILE" | PGPASSWORD="${PGPASSWORD}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$PGDATABASE"
fi

echo "[restore] Done. Database restored from $BACKUP_FILE"
