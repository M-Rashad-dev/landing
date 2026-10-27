# Architecture

A short map of how the pieces fit. Details: [PLAN.MD](../PLAN.MD); small choices: [DECISIONS.md](../DECISIONS.md).

```
browser ──https──▶ Caddy ──▶ Next (front:3000) ──internal key──▶ nginx (back-web) ──▶ php-fpm (Laravel)
                     │            ▲                                                       │
                     │            └────── POST /api/revalidate (secret) ◀── queue ◀───────┤
                     └── /media/* straight from the media volume                MySQL · Redis
```

Laravel is never exposed: only Next (and Caddy's TLS ask on the Docker network) talks to it.

## Hosts
`proxy.ts` (Next 16 middleware) classifies the `Host` header:

| Host | Serves |
|---|---|
| `PLATFORM_DOMAIN` | marketing page |
| `APP_HOST` | dashboard, builder, `/admin`, `/preview`, `/api/bff`, `/api/auth` |
| anything else | a tenant site, rewritten to `app/sites/[host]/[[...slug]]`; app-only paths answer 404 there |

## Tenancy (fail-closed)
- Every tenant table has `tenant_id` and uses `BelongsToTenant`. Its global `TenantScope` adds `tenant_id = ?`
  when a tenant is set and `1 = 0` when none is, so a forgotten context returns nothing instead of everything.
- The tenant comes from the token's user (`ResolveTenantFromUser`, before route-model binding) on dashboard routes,
  and from the active domain row on public routes (`PublicSite::activeDomainOrFail`, then `Tenancy::runAs`).
- Validation on tenant tables uses `TenantExists` / `TenantUnique`; ids from another tenant are 404.
- `Tenancy::withoutTenant()` only in audited places, each with an `Audited bypass` comment and covered by tests:
  host resolution and caching, TLS ask, domain uniqueness and activation, domain jobs + scheduler, `Tenant::activeHosts`,
  and the super admin controllers. `tests/Feature/Isolation/TenantIsolationTest.php` lists every dashboard resource.

## BFF and auth
- Login/register go through Next route handlers that keep the Sanctum token in the httpOnly `lp_token` cookie
  (SameSite=Lax, Secure in production). JavaScript never sees the token.
- `/api/bff/[...path]` forwards dashboard/admin calls to Laravel with the bearer token, after an `Origin` check
  on every non-GET request (CSRF).
- Visitor routes (`/api/public/form-token|quote|orders`) add the shared `X-Internal-Key`, the visited host and the
  visitor IP (first `X-Forwarded-For` entry, set by Caddy).

## Public sites
- `app/sites/[host]/[[...slug]]` renders server-side with ISR (`revalidate: 60`); data fetches carry the tag
  `host:{host}`. Laravel's `RevalidateTenantHosts` job calls `/api/revalidate` after anything that changes a public
  page (publish, identity, product, offer, code, domains, tenant status), so changes show in seconds.
- Laravel serves only the **published snapshot** of a page; identity, product and offers are live data.
- Host lookups are cached 60 s in Redis (`PublicSite`); Domain / Tenant model events clear them on every change.
- A non-primary host answers with a permanent redirect to the primary one; suspended tenants get an Arabic notice.
- SEO (title/description/canonical/OG/JSON-LD), sitemap.xml and robots.txt per host; tracking pixels only for
  ids that pass strict formats, injected with `JSON.stringify`.

## Prices and orders
- Money is `decimal(12,2)` in MySQL and integer cents in PHP. `PriceCalculator` is the only price authority
  (offers, bundle, codes, caps); the order form shows its quotes and the order stores its result.
- `CreateOrder`: published form settings decide validation, honeypot + signed form token (3 s – 2 h), blocked
  phones / IPs, rate limits counted on successful orders, code limits re-checked under a row lock, order numbers
  from a per-tenant counter row, idempotency key, duplicate flag.
- Status changes follow a fixed transition table (`OrderStatus::allowedTransitions`); fake / cancelled release the
  code use, fake can block the phone and IP. Every change is logged.

## Custom domains
`DomainRules` normalizes and validates; the customer adds one DNS record (A for a root domain, CNAME for a sub/www);
`DomainVerifier` checks it through a `DnsResolver` interface (real `dns_get_record`, fixed answers in tests) and
activates under a row lock with a unique `active_host`. Caddy issues certificates on demand only when
`GET /internal/tls/ask` says yes. `domains:verify-pending` re-checks pending domains every 5 minutes for 72 hours.

## Themes and the builder
- A page is `content = { version, sections: [{ id, type, variant, visible, props }] }`. The 10 component types and
  their props are shared by all themes (`front/src/themes/shared/schemas`), so switching theme keeps the content.
- Each theme implements every type with ≥ 2 variants; components only render (`props` + `ctx`) and take colors,
  fonts and radius from the identity's CSS variables.
- Laravel's `PageContentSanitizer` validates content on save (types, sizes, media ownership, safe URLs, depth).
- Add a theme / a component type: see the README ("Themes").

## Super admin
`/admin` (role `super_admin`, no tenant): counts, tenants, suspend / activate, owner password reset, themes on/off.
Every action is written to `admin_audit_logs` (who, what, target, IP).

## Testing
Pest (Unit + Feature on MySQL, incl. concurrency cases and a full API flow), Vitest + Testing Library (front units,
components, theme parity), Playwright (`pnpm e2e`, six scenarios on an isolated stack), bash smoke scripts per
phase, `scripts/load-test.mjs`.
