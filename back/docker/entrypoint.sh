#!/bin/sh
# Every container from this image (back-app, queue, scheduler) has its own filesystem, so each
# builds Laravel's config / route / event caches from the runtime env before starting.
set -e

if [ "${APP_ENV:-production}" = "production" ]; then
    php artisan optimize --no-interaction > /dev/null
fi

exec "$@"
