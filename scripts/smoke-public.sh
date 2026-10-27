#!/usr/bin/env bash
# Phase 8 smoke test: register → product → publish a page → visit http://{sub}.localhost:3000
# (title, JSON-LD, pixel, theme) → edit + republish shows up within seconds → 404s, sitemap, robots.
# Needs both apps running (tools/start-dev.sh) and the queue worker (revalidation).
set -euo pipefail

APP="${APP_URL:-http://app.localhost:3000}"
PORT="${PUBLIC_PORT:-3000}"
PHP="${PHP_BIN:-php}"
WORK="$(mktemp -d)"
JAR="$WORK/jar"
trap 'rm -rf "$WORK"' EXIT
STAMP="$(date +%s)"
PHONE="010$(printf '%08d' $(((STAMP + 11) % 100000000)))"

fail() { echo "FAIL: $*" >&2; exit 1; }
winpath() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
json() { "$PHP" -r '$d=json_decode(stream_get_contents(STDIN),true); foreach(explode(".",$argv[1]) as $k){ $d=$d[$k] ?? null; } echo is_scalar($d)?$d:json_encode($d, JSON_UNESCAPED_UNICODE);' "$1"; }
post() { printf '%s' "$3" > "$WORK/body.json"; curl -s -b "$JAR" -X "$1" -H "Origin: $APP" -H 'Content-Type: application/json' --data-binary "@$(winpath "$WORK/body.json")" -w '\n%{http_code}' "$APP/api/bff$2"; }
body() { echo "$1" | sed '$d'; }
status() { echo "$1" | tail -n1; }
code() { curl -s -o /dev/null -w '%{http_code}' "$1"; }
uuid() { "$PHP" -r 'echo sprintf("%04x%04x-%04x-4%03x-%04x-%04x%04x%04x", mt_rand(0,65535), mt_rand(0,65535), mt_rand(0,65535), mt_rand(0,4095), mt_rand(32768,49151), mt_rand(0,65535), mt_rand(0,65535), mt_rand(0,65535));'; }

reg=$(curl -s -c "$JAR" -H "Origin: $APP" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Public Smoke\",\"email\":\"public${STAMP}@example.com\",\"phone\":\"$PHONE\",\"store_name\":\"Public Store\",\"password\":\"secret-pass-1\",\"password_confirmation\":\"secret-pass-1\"}" \
  "$APP/api/auth/register")
HOST=$(echo "$reg" | json data.domain.host)
[ -n "$HOST" ] && [ "$HOST" != "null" ] || fail "register: $reg"
SITE="http://$HOST:$PORT"

pid=$(body "$(post POST /dashboard/products '{"name":"SMOKE-WATCH","price":"500","compare_at_price":"700","description":"**Great** watch","options":[]}')" | json data.id)

H=$(uuid); R=$(uuid); O=$(uuid); F=$(uuid)
content() {
  echo "{\"version\":1,\"sections\":[
 {\"id\":\"$H\",\"type\":\"header\",\"variant\":\"bar\",\"visible\":true,\"props\":{}},
 {\"id\":\"$R\",\"type\":\"hero\",\"variant\":\"big-type\",\"visible\":true,\"props\":{\"title\":\"$1\",\"cta_url\":\"#order\"}},
 {\"id\":\"$O\",\"type\":\"order_form\",\"variant\":\"bordered\",\"visible\":true,\"props\":{}},
 {\"id\":\"$F\",\"type\":\"footer\",\"variant\":\"dark-columns\",\"visible\":true,\"props\":{}}]}"
}

res=$(post POST /dashboard/pages "{\"title\":\"Smoke public\",\"slug\":\"smoke-offer\",\"theme_key\":\"celia\",\"product_id\":$pid,\"content\":$(content SMOKE-PUBLIC-V1)}")
[ "$(status "$res")" = "201" ] || fail "create page: $res"
page=$(body "$res" | json data.id)
identity=$(body "$res" | json data.identity_id)

res=$(post PUT "/dashboard/pages/$page" "{\"title\":\"Smoke public\",\"slug\":\"smoke-offer\",\"identity_id\":$identity,\"product_id\":$pid,\"seo_override\":{\"title\":\"SMOKE-SEO-TITLE\",\"description\":\"SMOKE-SEO-DESC\"},\"tracking_override\":{\"meta_pixel_id\":\"1234567890123\"}}")
[ "$(status "$res")" = "200" ] || fail "page settings: $res"

# Draft → 404 on the public host.
[ "$(code "$SITE/smoke-offer")" = "404" ] || fail "draft page should be 404"

[ "$(status "$(post POST "/dashboard/pages/$page/publish" '{}')")" = "200" ] || fail "publish"
[ "$(status "$(post POST "/dashboard/pages/$page/set-home" '{}')")" = "200" ] || fail "set home"
sleep 2

html=$(curl -s "$SITE/smoke-offer")
echo "$html" | grep -q "SMOKE-PUBLIC-V1" || fail "published content missing"
echo "$html" | grep -q "<title>SMOKE-SEO-TITLE" || fail "seo title"
echo "$html" | grep -q 'name="description" content="SMOKE-SEO-DESC"' || fail "seo description"
echo "$html" | grep -q 'rel="canonical" href="http://'"$HOST"':'"$PORT"'/"' || fail "canonical (home page)"
echo "$html" | grep -q 'application/ld+json' || fail "json-ld"
echo "$html" | grep -q '"@type":"Product"' || fail "json-ld product"
echo "$html" | grep -q '1234567890123' || fail "meta pixel id"
echo "$html" | grep -q 'og:locale' || fail "open graph"
echo "$html" | grep -q 'lang="ar"' || fail "lang"
[ "$(curl -s "$SITE/" | grep -c SMOKE-PUBLIC-V1)" -ge 1 ] || fail "home page"

# Edit the draft: the public page keeps the published version until republish.
res=$(post PUT "/dashboard/pages/$page/content" "{\"version\":1,\"content\":$(content SMOKE-PUBLIC-V2)}")
[ "$(status "$res")" = "200" ] || fail "save draft: $res"
sleep 1
curl -s "$SITE/smoke-offer" | grep -q "SMOKE-PUBLIC-V2" && fail "draft leaked to the public page"
[ "$(status "$(post POST "/dashboard/pages/$page/publish" '{}')")" = "200" ] || fail "republish"
ok=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  if curl -s "$SITE/smoke-offer" | grep -q "SMOKE-PUBLIC-V2"; then ok=1; break; fi
done
[ -n "$ok" ] || fail "republished content did not show up within 10 s (queue worker running?)"

# Errors and machine files.
[ "$(code "$SITE/no-such-page")" = "404" ] || fail "unknown slug 404"
[ "$(code "$SITE/a/b")" = "404" ] || fail "nested path 404"
[ "$(code "http://nobody-$STAMP.localhost:$PORT/")" = "404" ] || fail "unknown host 404"
curl -s "http://nobody-$STAMP.localhost:$PORT/" | grep -q "الصفحة غير موجودة" || fail "arabic 404"
[ "$(code "$SITE/dashboard")" = "404" ] || fail "dashboard on tenant host"
[ "$(code "$SITE/sites/$HOST")" = "404" ] || fail "direct /sites access"
curl -s "$SITE/sitemap.xml" | grep -q "<loc>http://$HOST:$PORT/</loc>" || fail "sitemap"
curl -s "$SITE/robots.txt" | grep -q "Sitemap: http://$HOST:$PORT/sitemap.xml" || fail "robots"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'X-Revalidate-Secret: wrong' -d '{"tags":["host:x"]}' "http://localhost:$PORT/api/revalidate")" = "401" ] || fail "revalidate secret"

echo "OK: public site smoke passed ($SITE)"
