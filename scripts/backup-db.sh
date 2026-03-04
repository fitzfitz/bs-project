#!/usr/bin/env bash
# Database Backup Script for The Barber Project
# Runs pg_dump and retains the last 7 days of backups.
#
# Usage: ./scripts/backup-db.sh
# Requires: pg_dump, DATABASE_URL env var (or individual PG* vars)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/barber-db}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/barber_${TIMESTAMP}.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Use DATABASE_URL if set, otherwise use individual PG* vars
if [ -n "${DATABASE_URL:-}" ]; then
  echo "[backup] Starting backup at $(date)"
  pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"
else
  PGHOST="${PGHOST:-localhost}"
  PGPORT="${PGPORT:-5432}"
  PGUSER="${PGUSER:-postgres}"
  PGDATABASE="${PGDATABASE:-barber-project}"
  echo "[backup] Starting backup of ${PGDATABASE}@${PGHOST}:${PGPORT} at $(date)"
  PGPASSWORD="${PGPASSWORD}" pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$PGDATABASE" | gzip > "$BACKUP_FILE"
fi

# Verify backup was created
if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[backup] Success: $BACKUP_FILE ($SIZE)"
else
  echo "[backup] ERROR: Backup file was not created!" >&2
  exit 1
fi

# Rotate old backups (keep last RETENTION_DAYS days)
find "$BACKUP_DIR" -name "barber_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
REMAINING=$(find "$BACKUP_DIR" -name "barber_*.sql.gz" | wc -l)
echo "[backup] Retained $REMAINING backup(s), cleaned files older than ${RETENTION_DAYS} days."
echo "[backup] Done at $(date)"
