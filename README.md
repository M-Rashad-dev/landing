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
php artisan platform:demo       # optional: demo store, pages, 24 orders + a super admin (not in production)
php artisan serve --port=8010
php artisan queue:work          # in another terminal (revalidation jobs)
php artisan schedule:work       # optional: re-checks pending custom domains every 5 minutes
```

`platform:demo` prints the logins: store owner `demo@example.com` and super admin `admin@example.com`
(password `demo-pass-123`, development only). A real super admin is created with
`php artisan platform:create-admin` (interactive, the password is never echoed).

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
pnpm e2e                        # builds, then Playwright on its own stack (Laravel :8011 + Next :3100, DB landing_e2e)
```

`pnpm e2e` runs the six end-to-end scenarios (register/login/logout, product + identity, build and publish a page,
order from the public page, the order in the dashboard + status change, theme switch). It recreates the
`landing_e2e` database each run and never touches the dev data; stop the dev servers first (both use `.next`).

Local hosts (no hosts-file edits needed, `*.localhost` resolves to 127.0.0.1):

| URL | What |
|-----|------|
| http://localhost:3000 | platform home page |
| http://app.localhost:3000 | dashboard (register / login) |
| http://{subdomain}.localhost:3000 | a tenant's public site |

### Smoke tests

```bash
# with both apps + the queue worker running (bash tools/start-dev.sh)
bash scripts/smoke-auth.sh
bash scripts/smoke-media.sh
bash scripts/smoke-products.sh
bash scripts/smoke-pricing.sh
bash scripts/smoke-pages.sh
bash scripts/smoke-public.sh    # publishes a page and visits http://{sub}.localhost:3000
bash scripts/smoke-orders.sh    # orders through the public site, statuses, block, code race, CSV
bash scripts/smoke-domains.sh   # custom domain via real DNS (*.localtest.me), primary redirect, race, TLS ask
bash scripts/smoke-admin.sh     # super admin: suspend → site + dashboard stop, activate, reset password (needs platform:demo)
node scripts/load-test.mjs      # 50 concurrent visitors × 10 rounds + 10 orders/s for 10 s (no errors, unique numbers)
node front/scripts/perf-check.mjs http://{sub}.localhost:3000/   # throttled phone metrics (LCP, CLS, long tasks)
bash scripts/measure-public-js.sh http://{sub}.localhost:3000/   # gzipped JS of a public page
```

Locally both apps need `PUBLIC_SCHEME=http` and `PUBLIC_PORT=3000` (canonical URLs, sitemap, redirects to the primary host);
production leaves the defaults (https, no port).

## Public sites

`proxy.ts` rewrites every tenant host to `app/sites/[host]/[[...slug]]` (ISR, 60 s, data tagged `host:{host}`).
Laravel's `FrontendRevalidator` calls `POST /api/revalidate` after publish/unpublish, page deletes, identity / product /
offer / code edits and page settings changes, so updates show within seconds. Each host also serves `/sitemap.xml` and
`/robots.txt`. Tracking pixels (Meta, TikTok, GA4, GTM, Snapchat) are injected only for ids matching the strict formats.

## Custom domains

Customers add one DNS record (root domain: `A @ → SERVER_IP`; subdomain / www: `CNAME → cname.{PLATFORM_DOMAIN}`).
Laravel checks it at once, then every 5 minutes for 72 hours (`php artisan schedule:work` runs `domains:verify-pending`),
activates the domain and warms its certificate. Caddy issues certificates on demand only for hosts that
`GET /internal/tls/ask?domain=` approves (platform hosts + active domains of active tenants). Locally, any
`*.localtest.me` name resolves to 127.0.0.1, so it verifies against `SERVER_IP=127.0.0.1` and opens at
`http://{name}.localtest.me:3000`. Production steps: [deploy/DEPLOY.md](deploy/DEPLOY.md).

## Super admin

`/admin` on the dashboard host (same login; super admins are redirected there): platform counts, tenants with
search and status filter, tenant details with domains, suspend (with a reason) / activate, owner password reset
(a 12-character temporary password shown once; every session of that owner ends), and themes on/off (a disabled
theme only disappears from new pages). Every admin action is written to `admin_audit_logs`.

## Production

`docker-compose.yml` + `deploy/`: Caddy (automatic HTTPS, on-demand certificates for custom domains), Next
(standalone), nginx + php-fpm, queue, scheduler, MySQL 8, Redis. Follow [deploy/DEPLOY.md](deploy/DEPLOY.md)
(Arabic, step by step): fill `.env` from `.env.example`, run `./deploy/deploy.sh`, then `platform:create-admin`.
Backups: `deploy/backup.sh` (daily cron) and `deploy/restore.sh`. Architecture notes: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Themes

Two themes ship today: **ملاك (`malak`)** soft & rounded, **سيليا (`celia`)** bold & square. Both implement the same 10
component types with the same props, so a page can switch theme without losing content.

```
front/src/themes/
  types.ts                 contracts (Section, PageContext, ThemeDef, FieldDef…)
  registry.ts              THEMES map + getTheme / getComponent / resolveVariant
  shared/schemas/<type>.ts fields + Arabic defaults per component (drive the Builder forms)
  shared/components/       building blocks (SafeLink, Price, Slider, Lightbox, Countdown…)
  shared/order-form/       order form fields/validation/parts; shared/hooks/use-order-form.ts
  malak/ celia/            theme.config.ts + components/<type>/index.tsx + thumbnails.tsx
  _fallback/               safety net for unknown types (never shown for the 10 known ones)
```

Rules: components only render (`props` + `ctx`, no fetching), colors/fonts/radius come from the identity CSS variables
(`--c-*`, `--font-heading`, `--font-body`, `--btn-radius` via the `.t-*` helpers in `globals.css`), RTL logical classes only,
interactive parts in small `"use client"` files. Review everything at `http://app.localhost:3000/dev/themes?theme=celia&identity=dark`
(development only).

### Add a theme
1. Create `front/src/themes/<key>/` with `theme.config.ts`, a component for each of the 10 types (≥ 2 variants each) and thumbnails.
2. Register it in `front/src/themes/registry.ts`.
3. Add a row to `back/database/seeders/ThemeSeeder.php` (runs on every deploy).
4. `pnpm test` — the parity test fails until every type/variant/thumbnail exists.

### Add a component type
1. Add a schema in `front/src/themes/shared/schemas/<type>.ts` (+ export it in `index.ts`) and the type to `COMPONENT_TYPES` in `types.ts`.
2. Add the type to `component_types` (and limits) in `back/config/landing.php`.
3. Implement it in **every** theme and add its thumbnail. Key naming rules matter: `*_media_id(s)`, `*_url`, `*_color`
   are validated by the back end (`PageContentSanitizer`).
