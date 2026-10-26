# منصة اللاندنج — Landing pages platform

Multi-tenant SaaS for single-product landing pages with cash-on-delivery orders.

- `back/` — Laravel 13 API (PHP 8.3, MySQL 8, Redis)
- `front/` — Next.js 16 (dashboard, page builder, public tenant sites)
- `deploy/` + `docker-compose.yml` — production on a single VPS (Docker + Caddy). See `deploy/DEPLOY.md`.

Spec: [PLAN.MD](PLAN.MD) · Status: [PROGRESS.md](PROGRESS.md) · Decisions: [DECISIONS.md](DECISIONS.md)

## Local development

### Requirements
PHP 8.3 (gd, intl, exif, pdo_mysql, bcmath), Composer 2, Node 20.19+, pnpm 10, MySQL 8 (or MariaDB 10.4+).
Redis is optional locally (use the database cache/queue drivers).

Optional services via Docker:

```bash
docker compose -f docker-compose.dev.yml up -d   # mysql :3306, mysql_test :3307, redis :6379
```

### Back (Laravel)

```bash
cd back
cp .env.example .env            # then set DB_* and, without Redis: CACHE_STORE=database QUEUE_CONNECTION=database
composer install
php artisan key:generate
openssl rand -hex 32            # → INTERNAL_API_KEY (same value in front/.env.local)
openssl rand -hex 32            # → REVALIDATE_SECRET (same value in front/.env.local)
php artisan migrate --seed
php artisan serve --port=8010
php artisan queue:work          # in another terminal (revalidation jobs)
```

Tests run against the `landing_test` database (see `phpunit.xml`):

```bash
composer test
composer lint
```

### Front (Next.js)

```bash
cd front
cp .env.example .env.local      # LARAVEL_INTERNAL_URL=http://127.0.0.1:8010 + the two shared secrets
pnpm install
pnpm dev                        # http://app.localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Local hosts (no hosts-file edits needed, `*.localhost` resolves to 127.0.0.1):

| URL | What |
|-----|------|
| http://localhost:3000 | platform home page |
| http://app.localhost:3000 | dashboard (register / login) |
| http://{subdomain}.localhost:3000 | a tenant's public site |

### Smoke tests

```bash
bash scripts/smoke-auth.sh      # with both apps running
```
