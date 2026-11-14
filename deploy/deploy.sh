#!/usr/bin/env bash
# First install and every update: ./deploy/deploy.sh  (safe to run again).
# Checks .env, builds the images, starts the stack, migrates, seeds the themes and checks health.
# Written without Docker on the dev machine: untested, see PROGRESS.md.
set -euo pipefail

cd "$(dirname "$0")/.."

fail() { echo "✗ $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

[ -f .env ] || fail ".env is missing: cp .env.example .env and fill it in."
command -v docker >/dev/null || fail "Docker is not installed."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is not installed."

set -a
# shellcheck disable=SC1091
. ./.env
set +a

for name in PLATFORM_DOMAIN APP_HOST SERVER_IP APP_KEY DB_DATABASE DB_USERNAME DB_PASSWORD DB_ROOT_PASSWORD INTERNAL_API_KEY REVALIDATE_SECRET REVERB_APP_ID REVERB_APP_KEY REVERB_APP_SECRET; do
  [ -n "${!name:-}" ] || fail "$name is empty in .env"
done
[ "$SERVER_IP" != "0.0.0.0" ] || fail "Set SERVER_IP to the server's public IP."
[ "$DB_PASSWORD" != "change-me" ] && [ "$DB_ROOT_PASSWORD" != "change-me-too" ] || fail "Change the database passwords in .env."
[[ "$APP_KEY" == base64:* ]] || fail "APP_KEY must look like base64:... (echo \"base64:\$(openssl rand -base64 32)\")."
[ "${#INTERNAL_API_KEY}" -ge 32 ] && [ "${#REVALIDATE_SECRET}" -ge 32 ] || fail "INTERNAL_API_KEY and REVALIDATE_SECRET need 32+ characters (openssl rand -hex 32)."

wait_healthy() { # $1 service, $2 seconds
  local id status
  for _ in $(seq 1 "$2"); do
    id=$(docker compose ps -q "$1")
    status=$([ -n "$id" ] && docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" || echo "missing")
    [ "$status" = "healthy" ] && return 0
    sleep 1
  done
  docker compose logs --tail=50 "$1" >&2 || true
  fail "$1 did not become healthy (last status: $status)."
}

step "Building images"
docker compose build --pull

step "Starting MySQL and Redis"
docker compose up -d mysql redis
wait_healthy mysql 180
wait_healthy redis 60

step "Starting Laravel"
docker compose up -d back-app
wait_healthy back-app 120

step "Migrating and seeding themes"
docker compose exec -T back-app php artisan migrate --force
docker compose exec -T back-app php artisan db:seed --class='Database\Seeders\ThemeSeeder' --force

step "Starting everything"
docker compose up -d --remove-orphans
wait_healthy back-web 120
wait_healthy front 180
wait_healthy caddy 60
# Workers pick up the new code.
docker compose exec -T back-app php artisan queue:restart

step "Health"
docker compose exec -T back-web wget -qO- http://127.0.0.1/health || fail "Laravel /health failed"
echo
docker compose exec -T front wget -qO- http://127.0.0.1:3000/api/health || fail "Next /api/health failed"
echo
docker compose ps

cat <<EOF

✓ Deployed.
  Dashboard:  https://$APP_HOST
  Platform:   https://$PLATFORM_DOMAIN
  Stores:     https://{store}.$PLATFORM_DOMAIN
  First time: docker compose exec back-app php artisan platform:create-admin
EOF
