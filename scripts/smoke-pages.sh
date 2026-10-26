#!/usr/bin/env bash
# Phase 5 smoke test: page with starter sections → builder/preview SSR → save + version conflict → publish blockers → publish.
set -euo pipefail

APP="${APP_URL:-http://app.localhost:3000}"
PHP="${PHP_BIN:-php}"
WORK="$(mktemp -d)"
JAR="$WORK/jar"
trap 'rm -rf "$WORK"' EXIT
STAMP="$(date +%s)"
PHONE="010$(printf '%08d' $(((STAMP + 7) % 100000000)))"

fail() { echo "FAIL: $*" >&2; exit 1; }
winpath() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
json() { "$PHP" -r '$d=json_decode(stream_get_contents(STDIN),true); foreach(explode(".",$argv[1]) as $k){ $d=$d[$k] ?? null; } echo is_scalar($d)?var_export($d,true):json_encode($d, JSON_UNESCAPED_UNICODE);' "$1"; }
post() { printf '%s' "$3" > "$WORK/body.json"; curl -s -b "$JAR" -X "$1" -H "Origin: $APP" -H 'Content-Type: application/json' --data-binary "@$(winpath "$WORK/body.json")" -w '\n%{http_code}' "$APP/api/bff$2"; }
body() { echo "$1" | sed '$d'; }
status() { echo "$1" | tail -n1; }

curl -s -c "$JAR" -H "Origin: $APP" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Pages Smoke\",\"email\":\"pages${STAMP}@example.com\",\"phone\":\"$PHONE\",\"store_name\":\"Pages Store\",\"password\":\"secret-pass-1\",\"password_confirmation\":\"secret-pass-1\"}" \
  "$APP/api/auth/register" | grep -q '"domain"' || fail "register"

pid=$(body "$(post POST /dashboard/products '{"name":"Shirt","price":"300","options":[]}')" | json data.id)

uuid() { "$PHP" -r 'echo sprintf("%04x%04x-%04x-4%03x-%04x-%04x%04x%04x", mt_rand(0,65535), mt_rand(0,65535), mt_rand(0,65535), mt_rand(0,4095), mt_rand(32768,49151), mt_rand(0,65535), mt_rand(0,65535), mt_rand(0,65535));'; }
H=$(uuid); R=$(uuid); F=$(uuid); O=$(uuid)
content="{\"version\":1,\"sections\":[
 {\"id\":\"$H\",\"type\":\"header\",\"variant\":\"centered-logo\",\"visible\":true,\"props\":{\"cta_label\":\"Order\",\"cta_url\":\"#order\"}},
 {\"id\":\"$R\",\"type\":\"hero\",\"variant\":\"split\",\"visible\":true,\"props\":{\"title\":\"SMOKE-HERO-TITLE\",\"cta_url\":\"#order\"}},
 {\"id\":\"$F\",\"type\":\"footer\",\"variant\":\"simple-center\",\"visible\":true,\"props\":{}}]}"

res=$(post POST /dashboard/pages "{\"title\":\"Smoke page\",\"slug\":\"smoke-page\",\"theme_key\":\"malak\",\"content\":$content}")
[ "$(status "$res")" = "201" ] || fail "create page: $res"
page=$(body "$res" | json data.id)

# Builder and preview render server-side with the draft content.
[ "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$APP/dashboard/pages/$page/builder")" = "200" ] || fail "builder page"
curl -s -b "$JAR" "$APP/preview/$page" | grep -q "SMOKE-HERO-TITLE" || fail "preview should render the draft"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$APP/preview/$page")" = "307" ] || fail "preview needs the cookie"

# Publish is blocked: no product, no order form.
res=$(post POST "/dashboard/pages/$page/publish" '{}')
[ "$(status "$res")" = "422" ] || fail "publish should be blocked"
body "$res" | grep -q '"no_product"' || fail "blocker no_product"
body "$res" | grep -q '"order_form_missing"' || fail "blocker order_form_missing"

# Save v1 → v2 with an order form; a stale save gets 409.
content2="{\"version\":1,\"sections\":[
 {\"id\":\"$H\",\"type\":\"header\",\"variant\":\"centered-logo\",\"visible\":true,\"props\":{}},
 {\"id\":\"$R\",\"type\":\"hero\",\"variant\":\"split\",\"visible\":true,\"props\":{\"title\":\"SMOKE-HERO-TITLE-2\"}},
 {\"id\":\"$O\",\"type\":\"order_form\",\"variant\":\"card\",\"visible\":true,\"props\":{}},
 {\"id\":\"$F\",\"type\":\"footer\",\"variant\":\"simple-center\",\"visible\":true,\"props\":{}}]}"
res=$(post PUT "/dashboard/pages/$page/content" "{\"version\":1,\"theme_key\":\"celia\",\"content\":$content2}")
[ "$(status "$res")" = "200" ] || fail "save content: $res"
[ "$(body "$res" | json data.version)" = "2" ] || fail "version should be 2"
res=$(post PUT "/dashboard/pages/$page/content" "{\"version\":1,\"content\":$content2}")
[ "$(status "$res")" = "409" ] || fail "stale save should be 409"
body "$res" | grep -q '"version_conflict"' || fail "conflict code"

# Unsafe link rejected with its path.
bad="${content2/\"title\":\"SMOKE-HERO-TITLE-2\"/\"title\":\"x\",\"cta_url\":\"javascript:alert(1)\"}"
res=$(post PUT "/dashboard/pages/$page/content" "{\"version\":2,\"content\":$bad}")
[ "$(status "$res")" = "422" ] || fail "unsafe url should be 422"
body "$res" | grep -q 'content.sections.1.props.cta_url' || fail "error path for unsafe url"

# Link the product and publish.
res=$(post PUT "/dashboard/pages/$page" "{\"title\":\"Smoke page\",\"slug\":\"smoke-page\",\"identity_id\":$(body "$(post GET /dashboard/pages/$page '')" | json data.identity_id),\"product_id\":$pid}")
[ "$(status "$res")" = "200" ] || fail "link product: $res"
res=$(post POST "/dashboard/pages/$page/publish" '{}')
[ "$(status "$res")" = "200" ] || fail "publish: $res"
[ "$(body "$res" | json data.status)" = "'published'" ] || fail "status published"

for path in pages pages/new "pages/$page"; do
  [ "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$APP/dashboard/$path")" = "200" ] || fail "page /dashboard/$path"
done
echo "OK: pages & builder smoke passed"
