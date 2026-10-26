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

## Phase 2
- **Uploads go one file per request from the dashboard** (each file gets its own progress bar and error); the API still accepts up to 10 files per request and is atomic per request (any failure → nothing kept, error on `files.{index}`).
- **Variants are always WebP** (thumb 320 / medium 800 / large 1600, never upscaled); `media.path` = large, `mime` = `image/webp`, `size_bytes` = size of the large file. Favicons add `icon32.png` / `icon180.png` (center-cropped squares).
- **`GET /dashboard/media?ids=1,2,3`** resolves specific items (max 100). Pickers and the Builder store ids only and resolve them through this.
- **Local media serving**: Laravel registers `GET /media/{path}` only outside production (strict path regex), and Next has a `/media/*` route handler that proxies it. In production Caddy serves `/media/*` from the volume before Next sees the request.
- **Identity fonts on public pages**: `scripts/copy-fonts.mjs` (runs before dev/build) copies the Arabic + Latin woff2 files from `@fontsource` into `public/fonts/` (git-ignored); public pages will emit `@font-face` rules only for the fonts their identity uses (`getFontCss`). The dashboard imports all six for live previews.
- **`colors.primary_foreground` is optional**; when empty the readable color (black/white with the higher WCAG contrast on `primary`) is used, both in the API resource and the front.
- **Identity text fields are stripped of HTML** on input; contact phones are stored as E.164; social links must be `https` on the network's own domain (sub-domains allowed, e.g. `m.facebook.com`).
- **The "identity used by pages" check** (409 on delete) lives in `IdentityUsageFinder`; it returns no pages until the pages table exists (phase 5 fills it in).
- **Revalidation job** is dispatched `afterCommit`, retries 3 times with backoff 5/20/60 s and logs a warning on each failure; with `FRONT_INTERNAL_URL` empty it logs and skips. Locally the queue runs on the database driver (`tools/start-dev.sh` starts a worker).
- **Tenant middleware runs before route-model binding** (`prependToPriorityList(SubstituteBindings, ResolveTenantFromUser)`), otherwise every bound id would 404 because the scope is fail-closed.
- **Factories** use the current tenant when called inside `Tenancy::runAs()` (tests).

## Phase 3
- **Money in code = integer cents** via `App\Support\Money` (string parsing, half-up rounding, never floats); the API returns amounts as JSON numbers with two decimals of precision, inputs are validated as `numeric|decimal:0,2`.
- **Product images** live in `product_media` rows managed by `SaveProduct` (delete + insert in order, `tenant_id` on every row); position 0 is the main image.
- **Nested sync errors** (an option/value id that does not belong to the product/option) are reported as 422 on the exact path (`options.0.id`, `options.0.values.2.id`).
- **Swatch colors** are required for swatch options and dropped (stored null) for other display types.
- **Duplicate** copies options, values and image links; the name gets « (نسخة)» (trimmed to 150 chars) and the copy is inactive.
- **Delete** checks pages through `ProductUsageFinder` and unlinks offers/codes in the same transaction; both hooks are filled in when those tables arrive (phases 4 and 5).
- **Public product** (`PublicProductResource`) hides sku/timestamps and inactive values; an option left with no active value is hidden entirely so it can never block an order.
- **Local smoke scripts** send JSON bodies from UTF-8 files: native Windows curl mangles non-ASCII command-line arguments. Register is rate limited (5/hour/IP), so locally run `php artisan cache:clear` before re-running the smoke scripts many times.

## Phase 4
- **Price engine lives in `app/Pricing/`** (`PriceCalculator`, `PriceMath`, `Quote`) instead of `app/Services/`: `PriceMath` is the pure arithmetic (unit-tested with tables), `PriceCalculator` loads offers/codes inside the tenant and applies 7.1 in order.
- **Percentages are stored as decimals ("25.00") and handled as percent×100 integers** (2500) so `round(x × value / 100)` stays integer with half-up rounding. Offer percentages are whole numbers 1–95; code percentages 1–100.
- **An offer that yields no discount is not "applied"** (e.g. bundle below its quantity, unprofitable bundle, fixed 0). Ties → highest priority → oldest id. Never two offers.
- **Quote vs order**: `quote()` returns `code_error` instead of throwing; the order flow (phase 9) turns `code_error` into a 422 on `code` and calls `quote(..., lockCode: true)` inside its transaction so the code row is locked (`lockForUpdate`) while limits are re-checked.
- **Unknown option ids** in a quote are rejected (422 on `options.{id}`), so the front can never send options of another product.
- **Dates from the dashboard**: naive `YYYY-MM-DDTHH:mm` strings are interpreted as Cairo wall time; strings with `Z`/offset are respected. The front converts datetime-local values (Cairo) to UTC ISO before sending, so both paths work. Egypt DST is handled by the IANA zone (`Africa/Cairo`).
- **Deleted codes are renamed `CODE--DEL{id}`** (the DB unique index on `(tenant_id, code)` includes soft-deleted rows), so the same code can be created again.
- **`discount_code_redemptions.order_id`** is unique now; its FK to `orders` is added with the orders table in phase 9.
- **Offers/codes are edited in dialogs** on their list pages (forms are short); both pages embed the price simulator.
- **MySQL identifier limit**: the long composite index on redemptions has an explicit short name.
