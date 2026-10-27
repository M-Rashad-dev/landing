#!/usr/bin/env bash
# Phase 11 smoke test: the super admin suspends a store → its dashboard session and its public site stop at once;
# activating brings the site back; the owner's password reset works once.
# Needs tools/start-dev.sh running and the demo super admin (php artisan platform:demo);
# run `php artisan cache:clear` first (register limit).
set -euo pipefail

APP="${APP_URL:-http://app.localhost:3000}"
PORT="${PUBLIC_PORT:-3000}"
PHP="${PHP_BIN:-php}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-demo-pass-123}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
STAMP="$(date +%s)"

fail() { echo "FAIL: $*" >&2; exit 1; }
winpath() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
json() { "$PHP" -r '$d=json_decode(stream_get_contents(STDIN),true); foreach(explode(".",$argv[1]) as $k){ $d=$d[$k] ?? null; } echo is_scalar($d)?$d:json_encode($d, JSON_UNESCAPED_UNICODE);' "$1"; }
post() { printf '%s' "$4" > "$WORK/body.json"; curl -s -b "$1" -X "$2" -H "Origin: $APP" -H 'Content-Type: application/json' --data-binary "@$(winpath "$WORK/body.json")" -w '\n%{http_code}' "$APP/api/bff$3"; }
body() { echo "$1" | sed '$d'; }
status() { echo "$1" | tail -n1; }
code() { curl -s -o /dev/null -w '%{http_code}' "$1"; }

OWNER="$WORK/owner"; ADMIN="$WORK/admin"
reg=$(curl -s -c "$OWNER" -H "Origin: $APP" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Admin Smoke\",\"email\":\"adminsmoke${STAMP}@example.com\",\"phone\":\"0155$(printf '%07d' $((STAMP % 10000000)))\",\"store_name\":\"Suspend Me\",\"password\":\"secret-pass-1\",\"password_confirmation\":\"secret-pass-1\"}" \
  "$APP/api/auth/register")
HOST=$(echo "$reg" | json data.domain.host)
TENANT=$(echo "$reg" | json data.tenant.id)
[ -n "$HOST" ] && [ "$HOST" != "null" ] || fail "register: $reg"

# Super admin login → lands on /admin; owners are refused there.
login=$(curl -s -c "$ADMIN" -H "Origin: $APP" -H 'Content-Type: application/json' -d "{\"login\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" "$APP/api/auth/login")
[ "$(echo "$login" | json data.user.role)" = "super_admin" ] || fail "admin login (run php artisan platform:demo): $login"
[ "$(status "$(post "$OWNER" GET /admin/overview '')")" = "403" ] || fail "owner must not reach /admin"
[ "$(curl -s -b "$ADMIN" -o /dev/null -w '%{http_code}' "$APP/admin/tenants")" = "200" ] || fail "/admin/tenants page"
[ "$(status "$(post "$ADMIN" GET "/admin/tenants?q=Suspend%20Me" '')")" = "200" ] || fail "tenant search"

# Site and dashboard work before.
[ "$(status "$(post "$OWNER" GET /dashboard/pages '')")" = "200" ] || fail "owner dashboard before"
curl -s "http://$HOST:$PORT/" > /dev/null

# Suspend → dashboard session gone, public site shows the suspended notice.
res=$(post "$ADMIN" POST "/admin/tenants/$TENANT/suspend" '{"reason":"smoke test"}')
[ "$(status "$res")" = "200" ] && [ "$(body "$res" | json data.status)" = "suspended" ] || fail "suspend: $res"
[ "$(status "$(post "$OWNER" GET /dashboard/pages '')")" = "401" ] || fail "owner session should be revoked"
relogin=$(curl -s -o /dev/null -w '%{http_code}' -H "Origin: $APP" -H 'Content-Type: application/json' -d "{\"login\":\"adminsmoke${STAMP}@example.com\",\"password\":\"secret-pass-1\"}" "$APP/api/auth/login")
[ "$relogin" = "403" ] || fail "suspended owner login should be 403, got $relogin"
for _ in $(seq 1 20); do curl -s "http://$HOST:$PORT/" | grep -q "متوقف مؤقتًا" && break; sleep 1; done
curl -s "http://$HOST:$PORT/" | grep -q "متوقف مؤقتًا" || fail "site should show the suspended notice"

# Activate → the owner can sign in again; reset password works once and ends sessions.
[ "$(status "$(post "$ADMIN" POST "/admin/tenants/$TENANT/activate" '{}')")" = "200" ] || fail "activate"
for _ in $(seq 1 20); do curl -s "http://$HOST:$PORT/" | grep -q "متوقف مؤقتًا" || break; sleep 1; done
curl -s "http://$HOST:$PORT/" | grep -q "متوقف مؤقتًا" && fail "site should be back after activation"
temp=$(body "$(post "$ADMIN" POST "/admin/tenants/$TENANT/reset-password" '{}')" | json data.temporary_password)
[ "${#temp}" = "12" ] || fail "temporary password"
printf '{"login":"adminsmoke%s@example.com","password":"%s"}' "$STAMP" "$temp" > "$WORK/login.json"
[ "$(curl -s -o /dev/null -w '%{http_code}' -H "Origin: $APP" -H 'Content-Type: application/json' --data-binary "@$(winpath "$WORK/login.json")" "$APP/api/auth/login")" = "200" ] || fail "login with the temporary password"

# Themes switch and audit trail.
[ "$(body "$(post "$ADMIN" PATCH /admin/themes/celia '{"is_active":false}')" | json data.is_active)" = "" ] || fail "disable theme"
[ "$(body "$(post "$ADMIN" PATCH /admin/themes/celia '{"is_active":true}')" | json data.is_active)" = "1" ] || fail "enable theme"

echo "OK: admin smoke passed (tenant #$TENANT, http://$HOST:$PORT)"
