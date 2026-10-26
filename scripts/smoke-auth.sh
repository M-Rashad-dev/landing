#!/usr/bin/env bash
# Phase 1 smoke test: register → dashboard → logout → login, all through Next (BFF).
# Requires both apps running: Laravel (LARAVEL_INTERNAL_URL) and Next on :3000.
set -euo pipefail

APP="${APP_URL:-http://app.localhost:3000}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT
STAMP="$(date +%s)"
PHONE="010$(printf '%08d' $((STAMP % 100000000)))"
EMAIL="smoke${STAMP}@example.com"

fail() { echo "FAIL: $*" >&2; exit 1; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

# 1) protected page without cookie → redirect to /login
[ "$(code "$APP/dashboard")" = "307" ] || fail "dashboard without cookie should redirect"

# 2) register (Origin header required by the BFF CSRF check)
body=$(curl -s -c "$JAR" -H "Origin: $APP" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Test\",\"email\":\"$EMAIL\",\"phone\":\"$PHONE\",\"store_name\":\"Smoke Store\",\"password\":\"secret-pass-1\",\"password_confirmation\":\"secret-pass-1\"}" \
  "$APP/api/auth/register")
echo "$body" | grep -q '"domain"' || fail "register: $body"
echo "$body" | grep -q '"token"' && fail "token must never reach the browser"
grep -q lp_token "$JAR" || fail "lp_token cookie missing"

# 3) register without Origin → 403
[ "$(code -H 'Content-Type: application/json' -d '{}' "$APP/api/auth/register")" = "403" ] || fail "missing Origin should be 403"

# 4) dashboard + BFF with cookie
[ "$(code -b "$JAR" "$APP/dashboard")" = "200" ] || fail "dashboard with cookie"
curl -s -b "$JAR" "$APP/api/bff/auth/me" | grep -q "$EMAIL" || fail "bff me"
[ "$(code -b "$JAR" -X PATCH -H 'Content-Type: application/json' -d '{"name":"X Store"}' "$APP/api/bff/dashboard/store")" = "403" ] || fail "BFF write without Origin should be 403"
[ "$(code -b "$JAR" -X PATCH -H "Origin: $APP" -H 'Content-Type: application/json' -d '{"name":"Renamed Store"}' "$APP/api/bff/dashboard/store")" = "200" ] || fail "BFF write with Origin"

# 5) logout clears the cookie and revokes the token
[ "$(code -b "$JAR" -c "$JAR" -X POST -H "Origin: $APP" "$APP/api/auth/logout")" = "204" ] || fail "logout"
[ "$(code -b "$JAR" "$APP/api/bff/auth/me")" = "401" ] || fail "me after logout should be 401"

# 6) login again with the phone number
body=$(curl -s -c "$JAR" -H "Origin: $APP" -H 'Content-Type: application/json' -d "{\"login\":\"$PHONE\",\"password\":\"secret-pass-1\"}" "$APP/api/auth/login")
echo "$body" | grep -q '"user"' || fail "login: $body"
[ "$(code -b "$JAR" "$APP/dashboard/settings")" = "200" ] || fail "settings after login"

# 7) host rules: admin paths 404 on a tenant host
[ "$(code "http://some-store.localhost:3000/dashboard")" = "404" ] || fail "dashboard on tenant host must 404"

echo "OK: auth smoke passed ($EMAIL)"
