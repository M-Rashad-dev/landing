# CLAUDE.md

Multi-tenant landing-page SaaS. Full spec: [PLAN.MD](PLAN.MD). Status: [PROGRESS.md](PROGRESS.md). Small decisions not in the plan: [DECISIONS.md](DECISIONS.md).

The rebuilt front end (once `front-v2/`) is now `front/`; the old one is deleted. Front-end conventions and history: [docs/frontend-v2/HANDOFF.md](docs/frontend-v2/HANDOFF.md). Deploy + stack overview: [deploy/DEPLOY.md](deploy/DEPLOY.md).

## Layout
- `back/` Laravel 13 API only (PHP 8.3). `front/` Next.js 16 (dashboard, builder, public sites). `deploy/` + root compose files for the VPS.
- Locally: `source tools/env.sh` puts portable PHP 8.3 first on PATH (Windows dev box). MySQL = XAMPP MariaDB (root, no password), DBs `landing` / `landing_test`.

## Non-negotiables
- Tenancy: every tenant table has `tenant_id` + `BelongsToTenant` (fail-closed global scope). Use `TenantExists` / `TenantUnique`, never plain `exists:` / `unique:` on tenant tables. `Tenancy::withoutTenant()` only in audited places, each with a comment and a test. Cross-tenant ids → 404.
- Every endpoint: Feature tests for success, validation, 401, tenant isolation.
- Money: `decimal(12,2)` in DB, integer cents in code, `PriceCalculator` is the only price authority.
- `declare(strict_types=1)` everywhere; thin controllers → FormRequest → Action/Service → Resource; backed enums.
- Front: TS strict, Server Components by default, RTL logical classes only (ms/me/ps/pe/start/end), every Arabic string in `src/messages/ar.ts`, react-hook-form + zod, 4 states per screen (skeleton/empty/error/toast).
- Prefer in-house solutions. An external service is allowed when clearly better: propose it with the reason, build it only after the owner approves, log it in DECISIONS.md, keep it behind our own interface with keys in `.env` only and a fake for tests/e2e. Approved so far: payment gateway (see `docs/features/RULES.md`). No TODOs, mocks or fake data left in code.

## Commands
- back: `composer test` (Pest), `composer lint` (Pint --test)
- front: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- demo data: `php artisan platform:demo` (owner `demo@example.com`, super admin `admin@example.com`, password `demo-pass-123`; refuses production)
- deploy files (`docker-compose.yml`, Dockerfiles, `deploy/*`) were never run here (no Docker): the first VPS deploy is their first run. A fresh database gets the base data + the owner's admin from `PLATFORM_ADMIN_*` (`PlatformAdminSeeder`)
- custom domains locally: `*.localtest.me` resolves to 127.0.0.1 (= local `SERVER_IP`), so it verifies through real DNS; tests swap `DnsResolver` (see `fakeDns()` in `tests/Feature/Domains`)
- realtime (support chat): `php artisan reverb:start --host=127.0.0.1 --port=8080` (started by `tools/start-dev.sh`); `REVERB_ALLOWED_ORIGINS` takes host names without port
- smoke: `bash scripts/smoke-*.sh` (needs both apps + queue running: `bash tools/start-dev.sh`; run `php artisan cache:clear` first to reset the register rate limit)

## Next 16 notes
- `src/proxy.ts` is the old middleware. Public sites render from `app/sites/[host]` (not `_sites`: underscore folders are private in Next).
- `revalidateTag(tag, profile)` needs the second argument. Cache Components are off (classic fetch cache with `revalidate` + `tags`).
