# Laravel API image (php-fpm). Used by the back-app, queue and scheduler services.
# Untested on this machine (no Docker in the dev environment) — see PROGRESS.md.

# 1) Dependencies without dev packages.
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --no-scripts --no-autoloader --ignore-platform-reqs
COPY . .
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative \
    && rm -rf tests

# 2) Runtime.
FROM php:8.3-fpm-alpine

# gd (jpeg/png/webp) for MediaProcessor, intl for idn_to_ascii, bcmath, pdo_mysql, opcache, pcntl, redis.
RUN apk add --no-cache icu-libs libjpeg-turbo libpng libwebp freetype libzip \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS icu-dev libjpeg-turbo-dev libpng-dev libwebp-dev freetype-dev libzip-dev linux-headers \
    && docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype \
    && docker-php-ext-install -j"$(nproc)" gd intl bcmath pdo_mysql opcache pcntl zip \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del .build-deps \
    && rm -rf /tmp/pear

COPY docker/php.ini /usr/local/etc/php/conf.d/zz-landing.ini
COPY docker/www.conf /usr/local/etc/php-fpm.d/zz-landing.conf
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/landing-entrypoint

WORKDIR /var/www/html
COPY --from=vendor --chown=www-data:www-data /app /var/www/html

# storage/app/public is the media volume (mounted by compose); the rest of storage stays writable.
RUN mkdir -p storage/app/public storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

USER www-data

EXPOSE 9000
ENTRYPOINT ["landing-entrypoint"]
CMD ["php-fpm", "-F"]
