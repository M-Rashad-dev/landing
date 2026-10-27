#!/usr/bin/env bash
# Restore a backup made by backup.sh. REPLACES the current database and media.
#   ./deploy/restore.sh /var/backups/landing/db-YYYYmmdd-HHMMSS.sql.gz /var/backups/landing/media-YYYYmmdd-HHMMSS.tar.gz
# Written without Docker on the dev machine: untested, see PROGRESS.md.
set -euo pipefail

cd "$(dirname "$0")/.."

DB_FILE="${1:-}"
MEDIA_FILE="${2:-}"
[ -f "$DB_FILE" ] && [ -f "$MEDIA_FILE" ] || { echo "Usage: $0 <db.sql.gz> <media.tar.gz>" >&2; exit 1; }
gzip -t "$DB_FILE" && gzip -t "$MEDIA_FILE" || { echo "A backup file is corrupt." >&2; exit 1; }

echo "This replaces the CURRENT database and every uploaded image with:"
echo "  $DB_FILE"
echo "  $MEDIA_FILE"
read -r -p "Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "Cancelled."; exit 1; }

# No new orders or jobs while restoring.
docker compose stop front queue scheduler

echo "Restoring the database..."
gunzip -c "$DB_FILE" | docker compose exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'

echo "Restoring media..."
APP_ID="$(docker compose ps -q back-app)"
MEDIA_DIR="$(cd "$(dirname "$MEDIA_FILE")" && pwd)"
docker run --rm --volumes-from "$APP_ID" -v "$MEDIA_DIR":/restore:ro alpine:3.20 sh -c \
  "find /var/www/html/storage/app/public -mindepth 1 -delete && tar xzf /restore/$(basename "$MEDIA_FILE") -C /var/www/html/storage/app/public && chown -R 82:82 /var/www/html/storage/app/public"

docker compose exec -T back-app php artisan migrate --force
docker compose exec -T back-app php artisan cache:clear
docker compose up -d front queue scheduler
docker compose exec -T back-app php artisan queue:restart

echo "✓ Restored. Public pages refresh within 60 seconds."
