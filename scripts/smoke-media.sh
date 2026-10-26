#!/usr/bin/env bash
# Phase 2 smoke test: upload 5 images, edit alt, identities, delete-in-use 409, default switch, media served.
set -euo pipefail

APP="${APP_URL:-http://app.localhost:3000}"
PHP="${PHP_BIN:-php}"
WORK="$(mktemp -d)"
JAR="$WORK/jar"
trap 'rm -rf "$WORK"' EXIT
STAMP="$(date +%s)"
PHONE="011$(printf '%08d' $((STAMP % 100000000)))"

fail() { echo "FAIL: $*" >&2; exit 1; }
# Native (Windows) curl needs Windows paths for -F uploads.
winpath() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
json() { "$PHP" -r '$d=json_decode(stream_get_contents(STDIN),true); $p=explode(".",$argv[1]); foreach($p as $k){ $d=$d[$k] ?? null; } echo is_scalar($d)?$d:json_encode($d);' "$1"; }

curl -s -c "$JAR" -H "Origin: $APP" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Media Smoke\",\"email\":\"media${STAMP}@example.com\",\"phone\":\"$PHONE\",\"store_name\":\"Media Store\",\"password\":\"secret-pass-1\",\"password_confirmation\":\"secret-pass-1\"}" \
  "$APP/api/auth/register" | grep -q '"domain"' || fail "register"

# 5 real JPEGs generated with GD
for i in 1 2 3 4 5; do
  "$PHP" -r '$i=imagecreatetruecolor(900,600); imagefill($i,0,0,imagecolorallocate($i,rand(0,255),rand(0,255),rand(0,255))); imagejpeg($i,$argv[1]);' "$WORK/img$i.jpg"
done

ids=()
for i in 1 2 3 4 5; do
  body=$(curl -s -b "$JAR" -H "Origin: $APP" -F "files[]=@$(winpath "$WORK/img$i.jpg");type=image/jpeg" -F purpose=general "$APP/api/bff/dashboard/media")
  id=$(echo "$body" | json data.0.id)
  [ -n "$id" ] || fail "upload $i: $body"
  ids+=("$id")
done
url=$(curl -s -b "$JAR" "$APP/api/bff/dashboard/media?ids=${ids[0]}" | json data.0.urls.thumb)
[ "$(curl -s -o /dev/null -w '%{http_code}' "$APP$url")" = "200" ] || fail "media not served at $url"

alt=$(curl -s -b "$JAR" -X PATCH -H "Origin: $APP" -H 'Content-Type: application/json' -d '{"alt":"<b>Product</b> photo"}' "$APP/api/bff/dashboard/media/${ids[0]}" | json data.alt)
[ "$alt" = "Product photo" ] || fail "alt: $alt"

payload() {
  cat <<JSON
{"name":"$1","brand_name":"متجر","logo_media_id":${ids[0]},"favicon_media_id":null,"og_image_media_id":null,
 "colors":{"primary":"$2","secondary":"#F5F3FF","accent":"#F59E0B","background":"#FFFFFF","foreground":"#111827","muted":"#6B7280","border":"#E5E7EB"},
 "font_heading":"tajawal","font_body":"cairo","button_radius":"full","contact":{},"socials":{},"tracking":{"conversion_event":"Lead"}}
JSON
}
second=$(curl -s -b "$JAR" -H "Origin: $APP" -H 'Content-Type: application/json' -d "$(payload 'هوية زرقاء' '#1D4ED8')" "$APP/api/bff/dashboard/identities" | json data.id)
[ -n "$second" ] || fail "create identity"

code=$(curl -s -o "$WORK/del.json" -w '%{http_code}' -b "$JAR" -X DELETE -H "Origin: $APP" "$APP/api/bff/dashboard/media/${ids[0]}")
[ "$code" = "409" ] || fail "delete in-use media should be 409 (got $code)"
grep -q 'identity_logo' "$WORK/del.json" || fail "409 should list usages"

curl -s -b "$JAR" -X POST -H "Origin: $APP" "$APP/api/bff/dashboard/identities/$second/make-default" | grep -q '"is_default":true' || fail "make default"
defaults=$(curl -s -b "$JAR" "$APP/api/bff/dashboard/identities" | grep -o '"is_default":true' | wc -l)
[ "$defaults" -eq 1 ] || fail "exactly one default identity expected (got $defaults)"

[ "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X DELETE -H "Origin: $APP" "$APP/api/bff/dashboard/media/${ids[4]}")" = "204" ] || fail "delete unused media"
for page in media identities identities/new "identities/$second"; do
  [ "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$APP/dashboard/$page")" = "200" ] || fail "page /dashboard/$page"
done

echo "OK: media & identities smoke passed"
