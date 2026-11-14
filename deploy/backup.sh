#!/usr/bin/env bash
# Daily backup: compressed MySQL dump + media volume archive, kept 14 days.
#   cron: 0 3 * * * cd /opt/landing && ./deploy/backup.sh >> /var/log/landing-backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-/var/backups/landing}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

# --single-transaction: consistent InnoDB snapshot without locking the shop.
docker compose exec -T mysql sh -c 'exec mysqldump --single-transaction --quick --routines --no-tablespaces -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  | gzip -9 > "$BACKUP_DIR/db-$STAMP.sql.gz.part"
mv "$BACKUP_DIR/db-$STAMP.sql.gz.part" "$BACKUP_DIR/db-$STAMP.sql.gz"

# The media volume, read through the back-app container's mounts.
APP_ID="$(docker compose ps -q back-app)"
[ -n "$APP_ID" ] || { echo "back-app is not running" >&2; exit 1; }
docker run --rm --volumes-from "$APP_ID" -v "$BACKUP_DIR":/backup alpine:3.20 \
  tar czf "/backup/media-$STAMP.tar.gz" -C /var/www/html/storage/app/public .
# Private files: payment receipts, support chat files (product sheets are temporary, skipped).
docker run --rm --volumes-from "$APP_ID" -v "$BACKUP_DIR":/backup alpine:3.20   tar czf "/backup/private-$STAMP.tar.gz" --exclude=./imports -C /var/www/html/storage/app/private .

find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.sql.gz' -o -name 'media-*.tar.gz' -o -name 'private-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete

echo "$(date -Is) backup ok: $BACKUP_DIR/db-$STAMP.sql.gz $BACKUP_DIR/media-$STAMP.tar.gz $BACKUP_DIR/private-$STAMP.tar.gz"
