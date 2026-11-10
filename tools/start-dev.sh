#!/usr/bin/env bash
# Starts Laravel (:8010) and the built Next app (:3000) for local smoke tests.
# Stop with: powershell -File tools/stop-dev.ps1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/tools/env.sh"
(cd "$ROOT/back" && php artisan serve --host=127.0.0.1 --port=8010 > "$ROOT/tools/laravel.log" 2>&1) &
(cd "$ROOT/back" && php artisan queue:work --sleep=1 --tries=3 > "$ROOT/tools/queue.log" 2>&1) &
# Scheduler: subscriptions:sweep (every minute), domain checks, lead pruning.
(cd "$ROOT/back" && php artisan schedule:work > "$ROOT/tools/schedule.log" 2>&1) &
(cd "$ROOT/front" && pnpm start > "$ROOT/tools/next.log" 2>&1) &
wait
