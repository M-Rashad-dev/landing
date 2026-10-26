# DECISIONS

Small decisions taken while implementing PLAN.MD that the plan did not spell out (or that the current tool versions forced). Newest at the bottom of each phase.

## Environment (agreed with the owner before starting)
- **Laravel 13 on portable PHP 8.3** (`tools/php`, git-ignored). The dev box has XAMPP PHP 8.2, which is left untouched. Production Docker image is PHP 8.3 as planned.
- **Local DB = XAMPP MariaDB 10.4** for dev and tests (`landing`, `landing_test`). Production is MySQL 8 (compose). Migrations avoid MySQL-only features so either works (and SQLite too).
- **No Redis on the dev box**: locally `CACHE_STORE=database`, `QUEUE_CONNECTION=database`; production compose sets Redis for cache, queue and rate limits. Tests use `array` cache and `sync` queue.
- **No Docker on the dev box**: deploy files are written and reviewed but not executed here; PROGRESS.md marks those checks "not run".
- Something else on the dev box already listens on port 8000, so the local Laravel server runs on **8010** (`LARAVEL_INTERNAL_URL=http://127.0.0.1:8010`).

## Phase 1
- **Next 16 renamed middleware to `proxy.ts`.** Host routing lives in `front/src/proxy.ts` (same logic the plan describes for `middleware.ts`).
- **Public renderer folder is `app/sites/[host]`, not `app/_sites`.** Next treats `_folders` as private (not routable). `/sites/*` is only reachable through the proxy rewrite: on the app and platform hosts it 404s, and on tenant hosts every path is prefixed with `/sites/{host}`, so a visitor can never address it directly.
- **Cache Components disabled** (`cacheComponents: false`). The plan's ISR model (`fetch` with `revalidate: 60` + `tags`) is the classic cache; Cache Components would require a different design.
- **`revalidateTag(tag, profile)`** requires a profile in Next 16; we will use `{ expire: 0 }` so a published change shows on the next request.
- **Tailwind v4**: theme tokens live in `globals.css` (`@theme`), there is no `tailwind.config.ts`.
- **shadcn/ui**: components are written in the shadcn style by hand on top of the `radix-ui` package (same code shadcn would copy in), no CLI/registry step. `Select` is a styled native `<select>` (better on mobile and for keyboard users).
- **Fonts**: Cairo (and the other identity fonts later) come from `@fontsource/*`, bundled at build time. The dashboard font is loaded by the app-side layouts only, so public pages ship only their identity fonts.
- **Cookie `Secure` flag follows the request protocol** (`x-forwarded-proto`), so it is always Secure in production behind Caddy, and local http testing still works.
- **Expired/invalid token in a Server Component** → redirect to `GET /api/auth/expired`, which clears the cookie and sends the user to `/login` (Server Components cannot delete cookies; without this the proxy would loop between /login and /dashboard).
- **BFF allow-list**: `/api/bff/*` only forwards to Laravel `dashboard/*`, `admin/*` and `auth/me`.
- **Laravel forwards the real client IP**: Next sends `X-Forwarded-For` (first hop from Caddy) and Laravel trusts proxies (`trustProxies('*')`), safe because Laravel is never exposed to the internet. Rate limits therefore apply per visitor, not per Next container.
- **Sanctum**: bearer tokens only (`guard => []`, `stateful => []`, `routes => false`), expiration 30 days enforced both by `expires_at` on each token and by `sanctum.expiration`.
- **Password change** revokes every other token of the user (keeps the current one).
- **Login error** for wrong password and unknown account is the same 422 `invalid_credentials` with «بيانات الدخول غير صحيحة»; inactive user / suspended tenant → 403 only after a correct password (so existence is never revealed to someone without the password).
- **Super admin hitting `/dashboard/*`** → 403 (no tenant); the front redirects super admins to `/admin`.
- **`users` table is not tenant-scoped** (login must find the user before a tenant is known); uniqueness of email/phone is global, so plain `unique:users` is correct there.
- **`$fillable` arrays** are used explicitly on every model (instead of Laravel 13's `#[Fillable]` attribute) to match the plan's wording and make audits grep-able.
- **jsdom pinned to 26** for Vitest: jsdom 30 needs Node 22 and the dev box has Node 20.19 (Docker uses Node 22).
