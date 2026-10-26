#!/usr/bin/env bash
# Phase 3 smoke test: t-shirt with size + swatch color + 4 ordered images; edit, reorder, delete a value.
set -euo pipefail

APP="${APP_URL:-http://app.localhost:3000}"
PHP="${PHP_BIN:-php}"
WORK="$(mktemp -d)"
JAR="$WORK/jar"
trap 'rm -rf "$WORK"' EXIT
STAMP="$(date +%s)"
PHONE="012$(printf '%08d' $((STAMP % 100000000)))"

fail() { echo "FAIL: $*" >&2; exit 1; }
winpath() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
json() { "$PHP" -r '$d=json_decode(stream_get_contents(STDIN),true); foreach(explode(".",$argv[1]) as $k){ $d=$d[$k] ?? null; } echo is_scalar($d)?var_export($d,true):json_encode($d);' "$1"; }
# Bodies go through a UTF-8 file: native curl on Windows mangles non-ASCII command-line arguments.
post() { printf '%s' "$3" > "$WORK/body.json"; curl -s -b "$JAR" -X "$1" -H "Origin: $APP" -H 'Content-Type: application/json' --data-binary "@$(winpath "$WORK/body.json")" "$APP/api/bff$2"; }

curl -s -c "$JAR" -H "Origin: $APP" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Products Smoke\",\"email\":\"products${STAMP}@example.com\",\"phone\":\"$PHONE\",\"store_name\":\"Shirts\",\"password\":\"secret-pass-1\",\"password_confirmation\":\"secret-pass-1\"}" \
  "$APP/api/auth/register" | grep -q '"domain"' || fail "register"

ids=()
for i in 1 2 3 4; do
  "$PHP" -r '$i=imagecreatetruecolor(800,800); imagefill($i,0,0,imagecolorallocate($i,rand(0,255),rand(0,255),rand(0,255))); imagejpeg($i,$argv[1]);' "$WORK/p$i.jpg"
  id=$(curl -s -b "$JAR" -H "Origin: $APP" -F "files[]=@$(winpath "$WORK/p$i.jpg");type=image/jpeg" "$APP/api/bff/dashboard/media" | json data.0.id)
  ids+=("$id")
done
media="[${ids[0]},${ids[1]},${ids[2]},${ids[3]}]"

body=$(post POST /dashboard/products "{\"name\":\"تيشيرت\",\"price\":\"350\",\"compare_at_price\":\"450\",\"media_ids\":$media,\"options\":[
  {\"name\":\"المقاس\",\"display_type\":\"buttons\",\"is_required\":true,\"values\":[{\"label\":\"S\"},{\"label\":\"M\"},{\"label\":\"L\"},{\"label\":\"XL\",\"price_delta\":\"25\"}]},
  {\"name\":\"اللون\",\"display_type\":\"swatch\",\"is_required\":true,\"values\":[{\"label\":\"أسود\",\"color_hex\":\"#000000\"},{\"label\":\"أبيض\",\"color_hex\":\"#FFFFFF\"}]}]}")
pid=$(echo "$body" | json data.id)
[ "$pid" != "null" ] && [ -n "$pid" ] || fail "create: $body"
[ "$(echo "$body" | json data.discount_percent)" = "22" ] || fail "discount percent: $(echo "$body" | json data.discount_percent)"

size_id=$(echo "$body" | json data.options.0.id)
s_id=$(echo "$body" | json data.options.0.values.0.id)
xl_id=$(echo "$body" | json data.options.0.values.3.id)
color=$(echo "$body" | json data.options.1)

# Reorder images (last first), drop value "M" and "L", rename S, move XL first, keep color option as-is.
reordered="[${ids[3]},${ids[0]},${ids[1]},${ids[2]}]"
color_payload=$("$PHP" -r '$o=json_decode($argv[1],true); $o["values"]=array_map(fn($v)=>["id"=>$v["id"],"label"=>$v["label"],"color_hex"=>$v["color_hex"]],$o["values"]); unset($o["is_required"]); echo json_encode($o, JSON_UNESCAPED_UNICODE);' "$color")
updated=$(post PUT "/dashboard/products/$pid" "{\"name\":\"تيشيرت قطن\",\"price\":\"350\",\"compare_at_price\":\"450\",\"media_ids\":$reordered,\"options\":[
  {\"id\":$size_id,\"name\":\"المقاس\",\"display_type\":\"buttons\",\"values\":[{\"id\":$xl_id,\"label\":\"XL\",\"price_delta\":\"30\"},{\"id\":$s_id,\"label\":\"Small\"}]},$color_payload]}")

# Reload from the API and verify
fresh=$(curl -s -b "$JAR" "$APP/api/bff/dashboard/products/$pid")
[ "$(echo "$fresh" | json data.media_ids)" = "$reordered" ] || fail "image order: $(echo "$fresh" | json data.media_ids)"
[ "$(echo "$fresh" | json data.main_image.id)" = "${ids[3]}" ] || fail "main image"
[ "$(echo "$fresh" | json data.options.0.values.0.label)" = "'XL'" ] || fail "value order"
[ "$(echo "$fresh" | json data.options.0.values.0.price_delta)" = "30" ] || fail "price delta"
[ "$(echo "$fresh" | json data.options.0.values.1.label)" = "'Small'" ] || fail "rename"
[ "$(echo "$fresh" | json data.options.0.values.2.label)" = "null" ] || fail "deleted values still present"
[ "$(echo "$fresh" | json data.options.1.values.1.color_hex)" = "'#FFFFFF'" ] || fail "swatch kept"

dup=$(post POST "/dashboard/products/$pid/duplicate" "{}" | json data.is_active)
[ "$dup" = "false" ] || fail "duplicate should be inactive"

for page in products products/new "products/$pid"; do
  [ "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$APP/dashboard/$page")" = "200" ] || fail "page /dashboard/$page"
done
echo "OK: products smoke passed"
