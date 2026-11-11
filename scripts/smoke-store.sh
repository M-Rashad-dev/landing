#!/usr/bin/env bash
# Stores smoke test through the real stack (Next :3000 → Laravel): a Pro store gets categories,
# products with variant stock and a negative option price, a store home from the Builder, store
# pages and menus; then a visitor browses "/", /products, a category, a product, prices a cart
# and checks out several lines. Stock goes down, the order shows in the dashboard.
# Needs tools/start-dev.sh running, the demo super admin (php artisan platform:demo) and
# `php artisan cache:clear` first to reset rate limits.
set -euo pipefail

APP="${APP_URL:-http://app.localhost:3000}"
PORT="${PUBLIC_PORT:-3000}"
PHP="${PHP_BIN:-php}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-demo-pass-123}"
WORK="$(mktemp -d)"
OWNER="$WORK/owner"; ADMIN="$WORK/admin"
trap 'rm -rf "$WORK"' EXIT
STAMP="$(date +%s)"
PHONE="010$(printf '%08d' $(((STAMP + 29) % 100000000)))"

fail() { echo "FAIL: $*" >&2; exit 1; }
winpath() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
json() { "$PHP" -r '$d=json_decode(stream_get_contents(STDIN),true); foreach(explode(".",$argv[1]) as $k){ $d=$d[$k] ?? null; } echo is_scalar($d)?$d:json_encode($d, JSON_UNESCAPED_UNICODE);' "$1"; }
post() { printf '%s' "$4" > "$WORK/body.json"; curl -s -b "$1" -X "$2" -H "Origin: $APP" -H 'Content-Type: application/json' --data-binary "@$(winpath "$WORK/body.json")" -w '\n%{http_code}' "$APP/api/bff$3"; }
public() { printf '%s' "$2" > "$WORK/pub.json"; curl -s -H 'Content-Type: application/json' -H "X-Forwarded-For: 10.9.$((STAMP % 200)).7" --data-binary "@$(winpath "$WORK/pub.json")" -w '\n%{http_code}' "$SITE$1"; }
body() { echo "$1" | sed '$d'; }
status() { echo "$1" | tail -n1; }
page() { curl -s -w '\n%{http_code}' "$SITE$1"; }
uuid() { "$PHP" -r 'echo sprintf("%04x%04x-%04x-4%03x-%04x-%04x%04x%04x", mt_rand(0,65535), mt_rand(0,65535), mt_rand(0,65535), mt_rand(0,4095), mt_rand(32768,49151), mt_rand(0,65535), mt_rand(0,65535), mt_rand(0,65535));'; }

reg=$(curl -s -c "$OWNER" -H "Origin: $APP" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Store Smoke\",\"email\":\"storesmoke${STAMP}@example.com\",\"phone\":\"$PHONE\",\"store_name\":\"Souq Smoke\",\"password\":\"secret-pass-1\",\"password_confirmation\":\"secret-pass-1\"}" \
  "$APP/api/auth/register")
HOST=$(echo "$reg" | json data.domain.host)
TENANT=$(echo "$reg" | json data.tenant.id)
[ -n "$HOST" ] && [ "$HOST" != "null" ] || fail "register: $reg"
SITE="http://$HOST:$PORT"

# New signups start on the Basic trial: the store is closed there.
[ "$(status "$(post "$OWNER" POST /dashboard/store/setup '{}')")" = "403" ] || fail "store must be closed on Basic"

login=$(curl -s -c "$ADMIN" -H "Origin: $APP" -H 'Content-Type: application/json' -d "{\"login\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" "$APP/api/auth/login")
[ "$(echo "$login" | json data.user.role)" = "super_admin" ] || fail "admin login (run php artisan platform:demo): $login"
[ "$(status "$(post "$ADMIN" POST "/admin/tenants/$TENANT/billing/grant" '{"plan_key":"pro","days":30,"note":"smoke"}')")" = "200" ] || fail "grant pro"
echo "ok: Pro granted"

men=$(body "$(post "$OWNER" POST /dashboard/categories '{"name":"رجالي","slug":"men"}')"); MEN=$(echo "$men" | json data.id)
shirts=$(body "$(post "$OWNER" POST /dashboard/categories "{\"name\":\"قمصان\",\"slug\":\"shirts\",\"parent_id\":$MEN}")"); SHIRTS=$(echo "$shirts" | json data.id)
[ "$(echo "$shirts" | json data.depth)" = "1" ] || fail "sub-category depth: $shirts"

p1=$(body "$(post "$OWNER" POST /dashboard/products "{\"name\":\"قميص كتان\",\"slug\":\"linen\",\"price\":\"300\",\"category_ids\":[$SHIRTS],\"is_featured\":true,\"stock_mode\":\"variant\",\"options\":[{\"name\":\"المقاس\",\"display_type\":\"buttons\",\"is_required\":true,\"values\":[{\"label\":\"M\"},{\"label\":\"S\",\"price_delta\":\"-20\"}]}],\"variants\":[{\"values\":{\"المقاس\":\"M\"},\"stock\":2},{\"values\":{\"المقاس\":\"S\"},\"stock\":1}]}")")
P1=$(echo "$p1" | json data.id); OPT=$(echo "$p1" | json data.options.0.id); S=$(echo "$p1" | json data.options.0.values.1.id)
[ "$(echo "$p1" | json data.variants.1.stock)" = "1" ] || [ "$(echo "$p1" | json data.variants.0.stock)" = "1" ] || fail "variant stock: $p1"
p2=$(body "$(post "$OWNER" POST /dashboard/products "{\"name\":\"حزام جلد\",\"slug\":\"belt\",\"price\":\"150\",\"category_ids\":[$MEN],\"stock_mode\":\"product\",\"stock\":5}")")
P2=$(echo "$p2" | json data.id)
echo "ok: categories + products"

G=$(uuid); C=$(uuid)
setup=$(post "$OWNER" POST /dashboard/store/setup "{\"content\":{\"version\":1,\"sections\":[
 {\"id\":\"$G\",\"type\":\"product_grid\",\"variant\":\"grid\",\"visible\":true,\"props\":{\"title\":\"وصل حديثًا\",\"source\":\"newest\",\"limit\":8}},
 {\"id\":\"$C\",\"type\":\"category_grid\",\"variant\":\"tiles\",\"visible\":true,\"props\":{\"title\":\"تسوق حسب التصنيف\",\"source\":\"top\",\"limit\":8}}]}}")
[ "$(status "$setup")" = "200" ] || fail "store setup: $setup"
HOME_ID=$(body "$setup" | json data.home.id)
[ "$(status "$(post "$OWNER" POST "/dashboard/pages/$HOME_ID/publish" '{}')")" = "200" ] || fail "publish store home"
[ "$(status "$(post "$OWNER" POST /dashboard/store-pages '{"title":"سياسة الاسترجاع","slug":"returns","body":"## الاسترجاع\n\nخلال 14 يوم"}')")" = "201" ] || fail "store page"
menus="{\"menus\":{\"header\":[{\"type\":\"category\",\"label\":\"رجالي\",\"target_id\":$MEN,\"children\":[{\"type\":\"category\",\"label\":\"قمصان\",\"target_id\":$SHIRTS}]}],\"footer\":[{\"type\":\"url\",\"label\":\"إنستجرام\",\"url\":\"https://instagram.com/souq\"}]}}"
[ "$(status "$(post "$OWNER" PUT /dashboard/store "$menus")")" = "200" ] || fail "menus"
live=$(body "$(post "$OWNER" PUT /dashboard/store '{"is_enabled":true}')")
[ "$(echo "$live" | json data.live)" = "1" ] || fail "store not live: $live"
echo "ok: store live"

home=$(page /)
[ "$(status "$home")" = "200" ] || fail "store home HTTP $(status "$home")"
echo "$home" | grep -q "وصل حديثًا" || fail "home misses the product grid"
echo "$home" | grep -q "قميص كتان" || fail "home misses the product"
echo "$home" | grep -q 'href="/categories/shirts"' || fail "home misses the header sub-menu"
list=$(page "/products?sort=price_asc")
[ "$(status "$list")" = "200" ] && echo "$list" | grep -q "حزام جلد" || fail "/products"
cat=$(page /categories/men)
echo "$cat" | grep -q "قميص كتان" || fail "category must include sub-category products"
prod=$(page /products/linen)
[ "$(status "$prod")" = "200" ] && echo "$prod" | grep -q 'application/ld+json' || fail "product page / JSON-LD"
[ "$(status "$(page /products/nope)")" = "404" ] || fail "unknown product must 404"
[ "$(status "$(page /pages/returns)")" = "200" ] || fail "store page"
[ "$(status "$(page /cart)")" = "200" ] && [ "$(status "$(page /checkout)")" = "200" ] || fail "cart / checkout pages"
curl -s "$SITE/sitemap.xml" | grep -q "/products/linen" || fail "sitemap misses the product"
echo "ok: storefront pages"

# Cart: 2 × M (300) + 1 × S (300 − 20) + 2 belts → 600 + 280 + 300 = 1180.
items="[{\"product_id\":$P1,\"quantity\":2,\"options\":{\"$OPT\":$(echo "$p1" | json data.options.0.values.0.id)}},{\"product_id\":$P1,\"quantity\":1,\"options\":{\"$OPT\":$S}},{\"product_id\":$P2,\"quantity\":2}]"
quote=$(body "$(public /api/public/store/quote "{\"items\":$items}")")
[ "$(echo "$quote" | json data.subtotal)" = "1180" ] || fail "quote: $quote"
too=$(public /api/public/store/quote "{\"items\":[{\"product_id\":$P1,\"quantity\":3,\"options\":{\"$OPT\":$S}}]}")
[ "$(status "$too")" = "422" ] || fail "more than the variant stock must be refused: $too"

TOKEN=$(curl -s "$SITE/api/public/store/form-token" | json data.token)
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || fail "form token"
sleep 4 # the token must be a few seconds old (anti-bot)
order=$(public /api/public/store/orders "{\"items\":$items,\"customer\":{\"name\":\"زائر المتجر\",\"phone\":\"0111$(printf '%07d' $((STAMP % 10000000)))\",\"governorate\":\"القاهرة\",\"address\":\"شارع 9\"},\"form_token\":\"$TOKEN\",\"website\":\"\",\"utm\":{\"source\":\"smoke\"}}")
[ "$(status "$order")" = "201" ] || fail "order: $order"
NUMBER=$(body "$order" | json data.order_number)
echo "ok: order #$NUMBER"

orders=$(body "$(post "$OWNER" GET /dashboard/orders '')")
[ "$(echo "$orders" | json data.0.source)" = "store" ] || fail "dashboard order source: $orders"
[ "$(echo "$orders" | json data.0.items_summary.count)" = "3" ] || fail "order lines: $orders"
belt=$(body "$(post "$OWNER" GET "/dashboard/products/$P2" '')")
[ "$(echo "$belt" | json data.stock)" = "3" ] || fail "stock not taken: $belt"
[ "$(status "$(post "$OWNER" GET /dashboard/store/analytics '')")" = "200" ] || fail "store analytics"

# Store off → "/" falls back to the landing home (none here: 404), store paths 404.
post "$OWNER" PUT /dashboard/store '{"is_enabled":false}' > /dev/null
echo "PASS: store smoke ($SITE)"
