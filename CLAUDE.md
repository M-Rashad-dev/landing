# CLAUDE.md

Multi-tenant landing-page SaaS. Full spec: [PLAN.MD](PLAN.MD). Status: [PROGRESS.md](PROGRESS.md). Small decisions not in the plan: [DECISIONS.md](DECISIONS.md).

## Layout
- `back/` Laravel 13 API only (PHP 8.3). `front/` Next.js 16 (dashboard, builder, public sites). `deploy/` + root compose files for the VPS.
- Locally: `source tools/env.sh` puts portable PHP 8.3 first on PATH (Windows dev box). MySQL = XAMPP MariaDB (root, no password), DBs `landing` / `landing_test`.

## Non-negotiables
- Tenancy: every tenant table has `tenant_id` + `BelongsToTenant` (fail-closed global scope). Use `TenantExists` / `TenantUnique`, never plain `exists:` / `unique:` on tenant tables. `Tenancy::withoutTenant()` only in audited places, each with a comment and a test. Cross-tenant ids → 404.
- Every endpoint: Feature tests for success, validation, 401, tenant isolation.
- Money: `decimal(12,2)` in DB, integer cents in code, `PriceCalculator` is the only price authority.
- `declare(strict_types=1)` everywhere; thin controllers → FormRequest → Action/Service → Resource; backed enums.
- Front: TS strict, Server Components by default, RTL logical classes only (ms/me/ps/pe/start/end), every Arabic string in `src/messages/ar.ts`, react-hook-form + zod, 4 states per screen (skeleton/empty/error/toast).
- No external services or API keys at runtime. No TODOs, mocks or fake data left in code.

## Commands
- back: `composer test` (Pest), `composer lint` (Pint --test)
- front: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- smoke: `bash scripts/smoke-auth.sh` (needs both apps running)

## Next 16 notes
- `src/proxy.ts` is the old middleware. Public sites render from `app/sites/[host]` (not `_sites`: underscore folders are private in Next).
- `revalidateTag(tag, profile)` needs the second argument. Cache Components are off (classic fetch cache with `revalidate` + `tags`).
