#!/usr/bin/env bash
# Phase 10 smoke test with real DNS and no mocks: *.localtest.me resolves to 127.0.0.1 publicly and
# SERVER_IP is 127.0.0.1 locally, so a custom domain verifies for real. Connect → active → page served
# on it → make primary → old subdomain redirects → two accounts race for one host → TLS ask → rename
# subdomain → delete primary custom domain.
# Needs tools/start-dev.sh running (incl. the queue); run `php artisan cache:clear` first (register limit).
set -euo pipefail

APP="${APP_URL:-http://app.localhost:3000}"
BACK="${BACK_URL:-http://127.0.0.1:8010}"
PORT="${PUBLIC_PORT:-3000}"
PHP="${PHP_BIN:-php}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
STAMP="$(date +%s)"

fail() { echo "FAIL: $*" >&2; exit 1; }
winpath() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
json() { "$PHP" -r '$d=json_decode(stream_get_contents(STDIN),true); foreach(explode(".",$argv[1]) as $k){ $d=$d[$k] ?? null; } echo is_scalar($d)?(is_bool($d)?($d?"true":"false"):$d):json_encode($d, JSON_UNESCAPED_UNICODE);' "$1"; }
# post JAR METHOD PATH BODY
post() { printf '%s' "$4" > "$WORK/body-$$.json"; curl -s -b "$1" -X "$2" -H "Origin: $APP" -H 'Content-Type: application/json' --data-binary "@$(winpath "$WORK/body-$$.json")" -w '\n%{http_code}' "$APP/api/bff$3"; }
body() { echo "$1" | sed '$d'; }
status() { echo "$1" | tail -n1; }
code() { curl -s -o /dev/null -w '%{http_code}' "$1"; }
location() { curl -s -o /dev/null -w '%{redirect_url}' "$1"; }
register() { # $1 jar, $2 name → prints the free subdomain host
  local phone="010$(printf '%08d' $(((STAMP + RANDOM) % 100000000)))"
  curl -s -c "$1" -H "Origin: $APP" -H 'Content-Type: application/json' \
    -d "{\"name\":\"Domains Smoke\",\"email\":\"$2${STAMP}@example.com\",\"phone\":\"$phone\",\"store_name\":\"$2 Store\",\"password\":\"secret-pass-1\",\"password_confirmation\":\"secret-pass-1\"}" \
    "$APP/api/auth/register" | json data.domain.host
}
# Wait (max ~20 s) until a URL answers with the expected status (pages are cached; revalidation goes through the queue).
wait_code() {
  for _ in $(seq 1 20); do [ "$(code "$1")" = "$2" ] && return 0; timeout 1 tail -f /dev/null 2>/dev/null || true; done
  fail "$1 should answer $2, got $(code "$1")"
}

A="$WORK/a"; B="$WORK/b"; C="$WORK/c"
SUB=$(register "$A" domainsa)
[ -n "$SUB" ] && [ "$SUB" != "null" ] || fail "register A"

# A published home page (a page needs a product and an order form to publish).
pid=$(body "$(post "$A" POST /dashboard/products '{"name":"Mug","price":"150"}')" | json data.id)
res=$(post "$A" POST /dashboard/pages "{\"title\":\"Domain page\",\"slug\":\"brand\",\"theme_key\":\"malak\",\"product_id\":$pid,\"content\":{\"version\":1,\"sections\":[
 {\"id\":\"9b2f1c3e-6a1d-4c7e-8f00-1a2b3c4d5e6f\",\"type\":\"hero\",\"variant\":\"split\",\"visible\":true,\"props\":{\"title\":\"SMOKE-DOMAINS-$STAMP\"}},
 {\"id\":\"0c1d2e3f-4a5b-4c6d-8e7f-8091a2b3c4d5\",\"type\":\"order_form\",\"variant\":\"card\",\"visible\":true,\"props\":{}}]}}")
[ "$(status "$res")" = "201" ] || fail "create page: $res"
page=$(body "$res" | json data.id)
res=$(post "$A" POST "/dashboard/pages/$page/publish" '{}'); [ "$(status "$res")" = "200" ] || fail "publish: $res"
[ "$(status "$(post "$A" POST "/dashboard/pages/$page/set-home" '{}')")" = "200" ] || fail "set home"

# Bad hosts are refused with the Arabic message.
res=$(post "$A" POST /dashboard/domains/custom '{"host":"shop.localhost"}')
[ "$(status "$res")" = "422" ] || fail "localhost host should be refused: $res"

# Connect a real domain: the DNS check passes right away.
CUSTOM="d${STAMP}.localtest.me"
res=$(post "$A" POST /dashboard/domains/custom "{\"host\":\"HTTP://${CUSTOM^^}/offer\"}")
[ "$(status "$res")" = "201" ] || fail "add custom: $res"
[ "$(body "$res" | json data.host)" = "$CUSTOM" ] || fail "host not normalized: $res"
[ "$(body "$res" | json data.status)" = "active" ] || fail "custom domain should be active: $res"
[ "$(body "$res" | json data.instructions.record.type)" = "CNAME" ] || fail "instructions: $res"
did=$(body "$res" | json data.id)

# Not primary yet → redirects to the free subdomain; primary → serves the page, old subdomain redirects.
wait_code "http://$CUSTOM:$PORT/" 308
[ "$(location "http://$CUSTOM:$PORT/")" = "http://$SUB:$PORT/" ] || fail "custom → subdomain redirect: $(location "http://$CUSTOM:$PORT/")"
[ "$(status "$(post "$A" POST "/dashboard/domains/$did/make-primary" '{}')")" = "200" ] || fail "make primary"
wait_code "http://$CUSTOM:$PORT/" 200
curl -s "http://$CUSTOM:$PORT/" | grep -q "SMOKE-DOMAINS-$STAMP" || fail "page not served on the custom domain"
curl -s "http://$CUSTOM:$PORT/" | grep -q "rel=\"canonical\" href=\"http://$CUSTOM:$PORT/\"" || fail "canonical should use the new primary"
wait_code "http://$SUB:$PORT/brand" 308
[ "$(location "http://$SUB:$PORT/brand")" = "http://$CUSTOM:$PORT/brand" ] || fail "subdomain → custom redirect: $(location "http://$SUB:$PORT/brand")"

# Caddy TLS ask: platform + active hosts only.
[ "$(code "$BACK/internal/tls/ask?domain=$CUSTOM")" = "200" ] || fail "ask active custom"
[ "$(code "$BACK/internal/tls/ask?domain=$SUB")" = "200" ] || fail "ask subdomain"
[ "$(code "$BACK/internal/tls/ask?domain=localhost")" = "200" ] || fail "ask platform"
[ "$(code "$BACK/internal/tls/ask?domain=nobody-$STAMP.localtest.me")" = "404" ] || fail "ask unknown"

# Two accounts race for the same host: exactly one gets it.
register "$B" domainsb > /dev/null
register "$C" domainsc > /dev/null
RACE="race${STAMP}.localtest.me"
( post "$B" POST /dashboard/domains/custom "{\"host\":\"$RACE\"}" > "$WORK/race-b" ) &
( post "$C" POST /dashboard/domains/custom "{\"host\":\"$RACE\"}" > "$WORK/race-c" ) &
wait
active=0
for f in "$WORK/race-b" "$WORK/race-c"; do
  [ "$(status "$(cat "$f")")" = "201" ] && [ "$(body "$(cat "$f")" | json data.status)" = "active" ] && active=$((active + 1))
done
[ "$active" = "1" ] || fail "exactly one account should own $RACE: $(cat "$WORK/race-b") / $(cat "$WORK/race-c")"
[ "$(code "$BACK/internal/tls/ask?domain=$RACE")" = "200" ] || fail "ask race winner"

# Rename the free subdomain: live availability, old name released at once.
NEWLABEL="renamed-$STAMP"
[ "$(body "$(post "$A" GET "/dashboard/domains/subdomain/availability?label=$NEWLABEL" '')" | json data.available)" = "true" ] || fail "availability"
[ "$(body "$(post "$A" GET '/dashboard/domains/subdomain/availability?label=admin' '')" | json data.available)" = "false" ] || fail "reserved label"
res=$(post "$A" PUT /dashboard/domains/subdomain "{\"label\":\"$NEWLABEL\"}")
[ "$(status "$res")" = "200" ] || fail "rename: $res"
NEWSUB="$NEWLABEL.localhost"
wait_code "http://$SUB:$PORT/" 404
wait_code "http://$NEWSUB:$PORT/" 308

# Deleting the primary custom domain hands primary back to the subdomain.
[ "$(status "$(post "$A" DELETE "/dashboard/domains/$did" '')")" = "204" ] || fail "delete custom"
wait_code "http://$NEWSUB:$PORT/" 200
wait_code "http://$CUSTOM:$PORT/" 404
[ "$(code "$BACK/internal/tls/ask?domain=$CUSTOM")" = "404" ] || fail "ask deleted domain"
[ "$(body "$(post "$A" GET /dashboard/domains '')" | json data.0.is_primary)" = "true" ] || fail "subdomain should be primary again"

echo "OK: domains smoke passed (http://$CUSTOM:$PORT → http://$NEWSUB:$PORT)"
