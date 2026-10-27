#!/usr/bin/env bash
# Phase 9 smoke test through the real stack (Next :3000 → Laravel): publish a page, order from
# http://{sub}.localhost:3000 with options × 2 + a code, check the dashboard, walk the statuses,
# mark fake + block, and race 5 concurrent orders on a code limited to 2 uses.
# Needs tools/start-dev.sh running; run `php artisan cache:clear` first to reset rate limits.
set -euo pipefail

APP="${APP_URL:-http://app.localhost:3000}"
PORT="${PUBLIC_PORT:-3000}"
PHP="${PHP_BIN:-php}"
WORK="$(mktemp -d)"
JAR="$WORK/jar"
trap 'rm -rf "$WORK"' EXIT
STAMP="$(date +%s)"
PHONE="010$(printf '%08d' $(((STAMP + 17) % 100000000)))"

fail() { echo "FAIL: $*" >&2; exit 1; }
winpath() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
json() { "$PHP" -r '$d=json_decode(stream_get_contents(STDIN),true); foreach(explode(".",$argv[1]) as $k){ $d=$d[$k] ?? null; } echo is_scalar($d)?$d:json_encode($d, JSON_UNESCAPED_UNICODE);' "$1"; }
post() { printf '%s' "$3" > "$WORK/body.json"; curl -s -b "$JAR" -X "$1" -H "Origin: $APP" -H 'Content-Type: application/json' --data-binary "@$(winpath "$WORK/body.json")" -w '\n%{http_code}' "$APP/api/bff$2"; }
body() { echo "$1" | sed '$d'; }
status() { echo "$1" | tail -n1; }
uuid() { "$PHP" -r 'echo sprintf("%04x%04x-%04x-4%03x-%04x-%04x%04x%04x", mt_rand(0,65535), mt_rand(0,65535), mt_rand(0,65535), mt_rand(0,4095), mt_rand(32768,49151), mt_rand(0,65535), mt_rand(0,65535), mt_rand(0,65535));'; }

reg=$(curl -s -c "$JAR" -H "Origin: $APP" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Orders Smoke\",\"email\":\"orders${STAMP}@example.com\",\"phone\":\"$PHONE\",\"store_name\":\"Orders Store\",\"password\":\"secret-pass-1\",\"password_confirmation\":\"secret-pass-1\"}" \
  "$APP/api/auth/register")
HOST=$(echo "$reg" | json data.domain.host)
[ -n "$HOST" ] && [ "$HOST" != "null" ] || fail "register: $reg"
SITE="http://$HOST:$PORT"

product=$(body "$(post POST /dashboard/products '{"name":"Shirt","price":"300","options":[{"name":"Size","display_type":"buttons","is_required":true,"values":[{"label":"M"},{"label":"XL","price_delta":"50"}]}]}')")
pid=$(echo "$product" | json data.id)
opt=$(echo "$product" | json data.options.0.id)
xl=$(echo "$product" | json data.options.0.values.1.id)
[ "$(status "$(post POST /dashboard/discount-codes '{"code":"SAVE10","type":"percentage","value":10,"usage_limit":50}')")" = "201" ] || fail "code SAVE10"
[ "$(status "$(post POST /dashboard/discount-codes '{"code":"RACE","type":"fixed","value":"20","usage_limit":2}')")" = "201" ] || fail "code RACE"

H=$(uuid); O=$(uuid)
res=$(post POST /dashboard/pages "{\"title\":\"Orders page\",\"slug\":\"buy\",\"theme_key\":\"malak\",\"product_id\":$pid,\"content\":{\"version\":1,\"sections\":[
 {\"id\":\"$H\",\"type\":\"hero\",\"variant\":\"split\",\"visible\":true,\"props\":{\"title\":\"Buy\"}},
 {\"id\":\"$O\",\"type\":\"order_form\",\"variant\":\"card\",\"visible\":true,\"props\":{}}]}}")
[ "$(status "$res")" = "201" ] || fail "create page: $res"
page=$(body "$res" | json data.id)
[ "$(status "$(post POST "/dashboard/pages/$page/publish" '{}')")" = "200" ] || fail "publish"

token() { curl -s "$SITE/api/public/form-token?slug=buy" | json data.token; }
order() { # $1 phone, $2 code, $3 ip, $4 token
  printf '{"slug":"buy","quantity":2,"options":{"%s":%s},"code":%s,"customer":{"name":"Smoke Buyer","phone":"%s","governorate":"القاهرة","address":"10 Nasr St"},"answers":{},"form_token":"%s","website":"","utm":{"source":"smoke"}}' \
    "$opt" "$xl" "$2" "$1" "$4" > "$WORK/order-$1.json"
  curl -s -H 'Content-Type: application/json' -H "X-Forwarded-For: $3" --data-binary "@$(winpath "$WORK/order-$1.json")" -w '\n%{http_code}' "$SITE/api/public/orders"
}

TOKEN=$(token)
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || fail "form token"

# Quote: 2 × (300 + 50) = 700, SAVE10 → 630.
printf '{"slug":"buy","quantity":2,"options":{"%s":%s},"code":"save10"}' "$opt" "$xl" > "$WORK/quote.json"
quote=$(curl -s -H 'Content-Type: application/json' --data-binary "@$(winpath "$WORK/quote.json")" "$SITE/api/public/quote")
[ "$(echo "$quote" | json data.total)" = "630" ] || fail "quote total: $quote"

# Too fast (token younger than 3 s) → generic rejection.
res=$(order 01011111111 '"SAVE10"' 41.0.0.1 "$TOKEN")
[ "$(status "$res")" = "422" ] && body "$res" | grep -q '"rejected"' || fail "fresh token should be rejected: $res"
sleep 4

res=$(order 01011111111 '"SAVE10"' 41.0.0.1 "$TOKEN")
[ "$(status "$res")" = "201" ] || fail "order: $res"
[ "$(body "$res" | json data.total)" = "630" ] || fail "order total: $res"
number=$(body "$res" | json data.order_number)
[ "$number" = "1001" ] || fail "first order number: $number"

# Dashboard shows the same numbers.
list=$(body "$(post GET /dashboard/orders '')")
oid=$(echo "$list" | json data.0.id)
[ "$(echo "$list" | json data.0.total)" = "630" ] || fail "dashboard total"
detail=$(body "$(post GET "/dashboard/orders/$oid" '')")
[ "$(echo "$detail" | json data.subtotal)" = "700" ] || fail "subtotal"
[ "$(echo "$detail" | json data.code.discount)" = "70" ] || fail "code discount"
[ "$(echo "$detail" | json data.items.0.options.0.value)" = "XL" ] || fail "options snapshot"
[ "$(echo "$detail" | json data.utm.source)" = "smoke" ] || fail "utm"
[ "$(echo "$detail" | json data.ip_address)" = "41.0.0.1" ] || fail "client ip from X-Forwarded-For"

# new → confirmed → delivered → returned, full timeline.
for s in confirmed delivered returned; do
  [ "$(status "$(post POST "/dashboard/orders/$oid/status" "{\"status\":\"$s\"}")")" = "200" ] || fail "status $s"
done
[ "$(status "$(post POST "/dashboard/orders/$oid/status" '{"status":"new"}')")" = "422" ] || fail "returned is final"
[ "$(body "$(post GET "/dashboard/orders/$oid" '')" | json data.logs.3.to_status)" = "returned" ] || fail "timeline"

# Fake + block phone: the next order from that phone is rejected and the code use is released.
res=$(order 01022222222 '"SAVE10"' 41.0.0.2 "$TOKEN")
[ "$(status "$res")" = "201" ] || fail "second order: $res"
oid2=$(body "$(post GET /dashboard/orders '')" | json data.0.id)
[ "$(status "$(post POST "/dashboard/orders/$oid2/status" '{"status":"fake","block_phone":true}')")" = "200" ] || fail "mark fake"
res=$(order 01022222222 null 41.0.0.3 "$TOKEN")
[ "$(status "$res")" = "422" ] && body "$res" | grep -q '"rejected"' || fail "blocked phone should be rejected: $res"
codes=$(body "$(post GET /dashboard/discount-codes '')")
echo "$codes" | grep -q '"code":"SAVE10","type":"percentage"' || true
used=$("$PHP" -r '$d=json_decode($argv[1],true); foreach($d["data"] as $c){ if($c["code"]==="SAVE10"){ echo $c["used_count"]; } }' "$codes")
[ "$used" = "1" ] || fail "SAVE10 used_count should be 1 after release, got $used"

# Race: 5 concurrent orders on RACE (limit 2) → exactly 2 succeed, numbers stay unique.
for i in 1 2 3 4 5; do
  ( { order "0123456789$i" '"RACE"' "41.1.1.$i" "$TOKEN" | tail -n1; echo; } > "$WORK/race-$i" ) &
done
wait
ok=$(cat "$WORK"/race-* | grep -c '^201$' || true)
[ "$ok" = "2" ] || fail "RACE should allow exactly 2 orders, got $ok ($(cat "$WORK"/race-* | tr '\n' ' '))"
numbers=$(body "$(post GET '/dashboard/orders?per_page=50' '')" | "$PHP" -r '$d=json_decode(stream_get_contents(STDIN),true); $n=array_column($d["data"],"order_number"); echo count($n)."/".count(array_unique($n));')
[ "${numbers%/*}" = "${numbers#*/}" ] || fail "duplicate order numbers: $numbers"

# Stats, export.
[ "$(body "$(post GET /dashboard/orders/stats '')" | json data.all)" = "4" ] || fail "stats all"
csv=$(curl -s -b "$JAR" -H "Origin: $APP" "$APP/api/bff/dashboard/orders/export")
printf '%s' "$csv" | head -c 3 | od -An -tx1 | grep -q "ef bb bf" || fail "CSV BOM"
printf '%s' "$csv" | grep -q "رقم الطلب" || fail "CSV header"

echo "OK: orders smoke passed ($SITE, $numbers orders)"
