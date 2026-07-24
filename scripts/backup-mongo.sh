#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="$(dirname "$0")/../backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE="${BACKUP_DIR}/mongo-backup-${TIMESTAMP}.archive"

mkdir -p "$BACKUP_DIR"

docker compose exec -T mongo mongodump \
  --archive \
  --gzip \
  --db=job-poster \
  > "$ARCHIVE"

echo "[Backup] Saved $ARCHIVE"

# Delete archives older than 14 days
find "$BACKUP_DIR" -name 'mongo-backup-*.archive' -mtime +14 -delete
