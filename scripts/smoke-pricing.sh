#!/usr/bin/env bash
# Phase 4 smoke test: "buy 2 for 350" starting tomorrow + EID25 (25%, max 100, limit 3) through the price simulator.
set -euo pipefail

APP="${APP_URL:-http://app.localhost:3000}"
PHP="${PHP_BIN:-php}"
WORK="$(mktemp -d)"
JAR="$WORK/jar"
trap 'rm -rf "$WORK"' EXIT
STAMP="$(date +%s)"
PHONE="015$(printf '%08d' $((STAMP % 100000000)))"

fail() { echo "FAIL: $*" >&2; exit 1; }
winpath() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
json() { "$PHP" -r '$d=json_decode(stream_get_contents(STDIN),true); foreach(explode(".",$argv[1]) as $k){ $d=$d[$k] ?? null; } echo is_scalar($d)?var_export($d,true):json_encode($d);' "$1"; }
post() { printf '%s' "$3" > "$WORK/body.json"; curl -s -b "$JAR" -X "$1" -H "Origin: $APP" -H 'Content-Type: application/json' --data-binary "@$(winpath "$WORK/body.json")" "$APP/api/bff$2"; }
cairo() { "$PHP" -r 'echo (new DateTime($argv[1], new DateTimeZone("Africa/Cairo")))->format("Y-m-d\TH:i");' "$1"; }

curl -s -c "$JAR" -H "Origin: $APP" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Pricing Smoke\",\"email\":\"pricing${STAMP}@example.com\",\"phone\":\"$PHONE\",\"store_name\":\"Prices\",\"password\":\"secret-pass-1\",\"password_confirmation\":\"secret-pass-1\"}" \
  "$APP/api/auth/register" | grep -q '"domain"' || fail "register"

pid=$(post POST /dashboard/products '{"name":"Mug","price":"200","options":[]}' | json data.id)

tomorrow=$(cairo 'tomorrow 00:00'); after=$(cairo 'tomorrow 00:00 +2 days')
offer=$(post POST /dashboard/offers "{\"name\":\"2 for 350\",\"type\":\"bundle\",\"bundle_quantity\":2,\"bundle_price\":\"350\",\"starts_at\":\"$tomorrow\",\"ends_at\":\"$after\",\"product_ids\":[$pid]}")
[ "$(echo "$offer" | json data.status)" = "'scheduled'" ] || fail "offer should be scheduled: $offer"

now=$(post POST /dashboard/pricing/preview "{\"product_id\":$pid,\"quantity\":2,\"options\":{}}")
[ "$(echo "$now" | json data.offer)" = "null" ] || fail "offer must not apply now"
[ "$(echo "$now" | json data.total)" = "400" ] || fail "total now: $(echo "$now" | json data.total)"

later=$(post POST /dashboard/pricing/preview "{\"product_id\":$pid,\"quantity\":2,\"options\":{},\"at\":\"$(cairo 'tomorrow 10:00')\"}")
[ "$(echo "$later" | json data.offer.type)" = "'bundle'" ] || fail "offer should apply tomorrow: $later"
[ "$(echo "$later" | json data.total)" = "350" ] || fail "bundle total"

post POST /dashboard/discount-codes '{"code":"eid25","type":"percentage","value":25,"max_discount":"100","usage_limit":3}' | grep -q '"EID25"' || fail "create code"

q=$(post POST /dashboard/pricing/preview "{\"product_id\":$pid,\"quantity\":1,\"options\":{},\"code\":\"eid25\"}")
[ "$(echo "$q" | json data.code.discount)" = "50" ] || fail "25% of 200 = 50: $q"
q=$(post POST /dashboard/pricing/preview "{\"product_id\":$pid,\"quantity\":4,\"options\":{},\"code\":\"EID25\"}")
[ "$(echo "$q" | json data.code.discount)" = "100" ] || fail "capped at 100: $q"
q=$(post POST /dashboard/pricing/preview "{\"product_id\":$pid,\"quantity\":2,\"options\":{},\"code\":\"EID25\",\"at\":\"$(cairo 'tomorrow 10:00')\"}")
[ "$(echo "$q" | json data.total)" = "262.5" ] || fail "offer + code (350 - 87.5): $q"
q=$(post POST /dashboard/pricing/preview "{\"product_id\":$pid,\"quantity\":1,\"options\":{},\"code\":\"NOPE\"}")
[ "$(echo "$q" | json data.code_error)" != "null" ] || fail "invalid code should report code_error"

for page in offers discount-codes; do
  [ "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$APP/dashboard/$page")" = "200" ] || fail "page /dashboard/$page"
done
echo "OK: pricing smoke passed"
