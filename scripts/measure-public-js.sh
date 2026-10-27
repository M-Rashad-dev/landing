#!/usr/bin/env bash
# Gzipped JavaScript a modern browser downloads for one public page (noModule polyfills excluded).
# Usage: bash scripts/measure-public-js.sh http://store.localhost:3000/offer
set -euo pipefail
URL="${1:?page url}"
ORIGIN="$(echo "$URL" | sed -E 's#^(https?://[^/]+).*#\1#')"
HTML="$(curl -s "$URL")"
total=0
for src in $(echo "$HTML" | grep -o '<script[^>]*src="/_next/[^"]*"[^>]*>' | grep -v noModule | grep -o 'src="[^"]*"' | sed 's/src="//;s/"$//' | sort -u); do
  size=$(curl -s "$ORIGIN$src" | gzip -9 | wc -c)
  total=$((total + size))
  printf '%7d  %s\n' "$size" "$src"
done
echo "total JS (gzip): $((total / 1024)) KB"
