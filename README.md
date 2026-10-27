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
