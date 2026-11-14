# Laravel API image (php-fpm). Used by the back-app, queue and scheduler services.

# 1) Dependencies without dev packages.
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --no-scripts --no-autoloader --ignore-platform-reqs
COPY . .
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative \
    && rm -rf tests

# 2) Runtime.
# Debian (glibc), not Alpine: musl's iconv can't read Windows-1256 CSV files (Arabic Excel exports).
FROM php:8.3-fpm-bookworm
RUN apt-get update \
    && apt-get install -y --no-install-recommends procps libicu72 libjpeg62-turbo libpng16-16 libwebp7 libfreetype6 libzip4 \
        libicu-dev libjpeg62-turbo-dev libpng-dev libwebp-dev libfreetype6-dev libzip-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype \
    && docker-php-ext-install -j"$(nproc)" gd intl bcmath pdo_mysql opcache pcntl zip \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apt-get purge -y libicu-dev libjpeg62-turbo-dev libpng-dev libwebp-dev libfreetype6-dev libzip-dev \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* /tmp/pear
COPY docker/php.ini /usr/local/etc/php/conf.d/zz-landing.ini
COPY docker/www.conf /usr/local/etc/php-fpm.d/zz-landing.conf
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/landing-entrypoint

WORKDIR /var/www/html
COPY --from=vendor --chown=www-data:www-data /app /var/www/html

# storage/app/public is the media volume (mounted by compose); the rest of storage stays writable.
RUN mkdir -p storage/app/public storage/app/private storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

USER www-data

EXPOSE 9000
ENTRYPOINT ["landing-entrypoint"]
CMD ["php-fpm", "-F"]
