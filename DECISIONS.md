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

## Phase 5
- **The live page keeps the theme it was published with.** `landing_pages.theme_key` is the draft (Builder) theme; on publish it is copied into `published_content.theme_key`, and the public renderer uses that. Switching themes in the Builder therefore never changes the live site until the next publish (the plan listed theme changes as a revalidation trigger; publishing already triggers it). Identity and product stay live-linked as the plan says.
- **Unpublishing clears `published_content` and the home flag** (an unpublished page cannot be the home page; `/` then 404s until another published page is set as home).
- **Uppercase slugs are lowercased** instead of rejected; soft-deleted pages get `{slug}--deleted-{id}` (the sanitizer and slug rule refuse `--deleted-` in user slugs).
- **One order form per page, visible or not** (sanitizer max per type = 1); a hidden order form counts as "missing" for publishing.
- **Depth limit (5) applies to section `props`**, and list-in-list values are rejected; strings are tag-stripped and capped (200 for `title`, `*_title`, `eyebrow`; 5000 otherwise); keys must match `^[a-z][a-z0-9_]{0,59}$`.
- **`landing_page_media` tracks draft + published + SEO image**, so an image still shown on the live page can't be deleted after it was removed from the draft.
- **Builder preview data** comes from `GET /dashboard/pages/{id}/preview`, built by `PublicPageData` — the same presenter the public API will use in phase 8 (identity/product/offers/media shapes are identical). `media` resolves every `*_media_id(s)` in the content; the Builder resolves newly picked images client-side and sends them with each `builder:update`.
- **Theme components are universal (no hooks/fetching)**: the public page renders them as Server Components, the preview iframe renders the same files as client components so edits show instantly via postMessage. Interactive parts live in small `"use client"` files.
- **Schemas carry two extra field types** beyond the plan's list: `order_fields` (the 7 built-in customer fields with enabled/required/label/placeholder, name & phone locked) and `custom_fields` (key generated once from the label: latin slug or `field_xxxx`). Repeater items use a plain `icon` key for icons.
- **Stored props are merged over schema defaults at render time**, so adding a field later never breaks older pages.
- **The Builder route lives in its own route group** `(builder)` (full screen, same session, no sidebar).
- **Builder shortcuts**: Ctrl/Cmd+S save, Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo (undo/redo ignored while typing in inputs). Autosave 1.5 s after the last edit; edits made while a save is in flight stay "unsaved" and are saved next.

## Phase 6
- **Theme helper classes** (`.t-primary`, `.t-tint`, `.t-muted`, `.t-heading`, `.t-btn`, `.t-input`, …) live in `globals.css` and only read the identity variables, so theme markup stays short and never hardcodes brand colors. Buttons always use the identity radius (`--btn-radius`) in both themes; each theme's personality comes from cards, spacing, borders and shadows.
- **Variants are separate components inside each type's `index.tsx`** (one folder per type) instead of one file per variant; thumbnails for a theme live in one `thumbnails.tsx`.
- **Shared building blocks** in `themes/shared/components` (SafeLink, Price, ResponsiveImage, Countdown, Slider, Lightbox, GalleryClient, OptionSelector, QuantityStepper, RatingStars, MobileMenu, ContactList/SocialLinks, ProofImage, PreviewEmpty) and `themes/shared/order-form` (fields + validation + parts). Both themes compose them with their own classes.
- **lucide 1.x has no brand icons**, so social glyphs are small inline SVGs (`social-icons.tsx`).
- **FAQ uses native `<details>`**; when only one answer may be open, items share `name="faq-{sectionId}"` (exclusive accordion, no JavaScript).
- **Empty sections render nothing on live pages** and a faint dashed placeholder in the Builder preview, so they stay selectable.
- **`useOrderForm` is implemented in full now** (fields, validation mirroring 7.3, live quote with a local estimate, form token, idempotency key, UTM, success + one-time conversion event); it calls the `/api/public/*` routes that phase 9 adds. In preview mode it never sends anything.
- **`track()` and UTM capture** (`lib/tracking`) are written now because the order form uses them; pixel script injection comes with phase 8.
- **Visual review** was done with Playwright screenshots of `/dev/themes` (390 / 768 / 1280, three very different identities incl. a dark one); an automated check confirms no horizontal overflow. `/dev/themes` accepts `?theme=&identity=` and returns 404 in production.

## Phase 7
- **Celia's personality lives in borders and shadows, not in props**: the same props as Malak, with hard 2–3px `--c-fg` borders and solid offset shadows (`.t-hard`), uppercase headings and dark inverted bands. Buttons still follow the identity radius.
- **"الأكثر طلبًا"** in Celia's bundle tiles marks the offer with the biggest saving (display only).
- **Sticky summary on mobile** becomes an inline summary + a fixed bottom bar (total + "اطلب الآن") shown only while the form is off screen (IntersectionObserver), so it never covers the form itself.
- **Parity is enforced by a test** (`themes/parity.test.tsx`) instead of a manual checklist: a new theme fails CI until it implements every type, variant default and thumbnail, and a full page must keep all its texts and images when switching theme.

## Phase 8
- **Public routes live in `app/sites/[host]`** (not `_sites`: Next treats underscore folders as private). They are reachable only through the proxy rewrite; `/sites/...` requested on any host ends up as a 404.
- **ISR via an empty `generateStaticParams`** + `revalidate = 60`: each host/slug renders on first visit and is cached; the Laravel data fetches carry the `host:{host}` tag, and `/api/revalidate` expires them immediately (`revalidateTag(tag, { expire: 0 })`).
- **No request headers in the page** (that would make it dynamic). The redirect to the primary host is built from `PUBLIC_SCHEME` / `PUBLIC_PORT` (production: https, no port). It uses Next's `permanentRedirect` (HTTP 308, treated like 301 by browsers and search engines) and drops the query string, since the cached page cannot read it; ads should point at the primary host.
- **The live page uses the theme stored in the published snapshot** (`published_content.theme_key`), while identity, product and offers are live data (revalidated on change).
- **SEO title**: page override → identity SEO title → product name → page title, then the identity suffix (once). Description: override → identity → product description as plain text (160 chars). OG image: override → identity → first product image. Canonical always points at the primary host.
- **Tracking ids are validated three times**: on save (back), again when merged for the public API, and by `validTracking` before any snippet is built; ids are inserted with `JSON.stringify`.
- **ViewContent** is sent once from `TrackingScripts` after every configured loader has defined its global (max 5 s); PageView comes from each loader itself. GTM receives `dataLayer` events only when GTM is configured (gtag already feeds GA4).
- **Visitor texts are split into `messages/site.ts`** (re-exported as `ar.site`) and order form runtime constants into `order-form/constants.ts`, so client islands on public pages don't pull the whole dashboard dictionary.
- **JS budget**: 166 KB gzip measured; the framework alone is ~131 KB, so the plan's ~120 KB target can't be met without dropping React/Next. Further optional saving: replacing `tailwind-merge` in theme code (8.6 KB).

## Phase 9
- **Rate limits count successful orders** (5 / 10 min per IP, 3 per phone, keys include the tenant), so a visitor fixing validation errors is not locked out; a looser limiter (20 attempts / min per IP) guards the endpoint itself.
- **Bots and blocked customers get the same generic 422 `rejected`** (no hint about which check failed).
- **Idempotency**: the form sends a UUID per submit; the created order is cached for 30 min under a cache lock, so a retried request returns the same order instead of a second one.
- **Client IP**: the Next route handler takes the first `X-Forwarded-For` entry (Caddy sets it in production) and forwards it with the internal key; Laravel accepts only a valid IP there.
- **Default form fields**: a published `order_form` without a `fields` prop uses the schema defaults (the renderer merges props over defaults shallowly). `OrderForm::DEFAULT_FIELDS` mirrors them and a front test compares both lists.
- **Reopening a fake / cancelled order does not consume the code again** (the code may have reached its limit meanwhile); the order keeps its locked price.
- **The public form validates with `validateAll`** (no zod in the visitor bundle); `buildSchema` (zod) uses the same rules and is tested to agree.
- **CSV export**: values starting with `= + - @` or tab / CR get a leading `'` (formula injection); the stream runs inside `Tenancy::runAs` because it is sent after the middleware has finished.
- **Order numbers** come from a per-tenant counter row (`insertOrIgnore` then `lockForUpdate`), never `max()+1`.

## Phase 10
- **Pending hosts are not exclusive.** Two accounts may add the same host; the first to pass the DNS check gets it (row lock, then the unique `active_host` index as the last guard). The loser stays pending with «الدومين ده مربوط بحساب آخر». Only an *active* host at another tenant is refused up front.
- **Root vs subdomain without a public-suffix library**: hosts under a configured list of two-part suffixes (`com.eg`, `co.uk`, …, `config/landing.php`) count as root domains. Unknown multi-part suffixes fall back to "last two labels".
- **Arabic domains** are stored as punycode (intl `idn_to_ascii`, UTS #46 non-transitional); the dashboard shows the stored ASCII form, which is what DNS providers show.
- **The free subdomain can be made primary again** from its card (not only by deleting the custom domain).
- **Extra endpoints not in the plan's table**: `GET /domains/subdomain/availability` (live check in the rename dialog) and `POST /domains/{id}/check-ssl` (the «فحص SSL» button). Both are tenant-scoped; check-ssl shares the 10/min limit with verify.
- **WarmSsl uses `PUBLIC_SCHEME` / `PUBLIC_PORT`**: production requests `https://{host}/api/health` (this is what triggers Caddy's certificate); locally it requests over plain http, so «SSL مفعّل» there only means reachable.
- **Re-checking a failed domain** happens only on «تحقق الآن» (the scheduler skips failed ones); success activates it like a pending one.
- **Page links use the session's public origin** (`PUBLIC_SCHEME` / `PUBLIC_PORT` read on the server in `getSession`) instead of guessing https vs http from the host, so custom domains link correctly in development too.
- **Local custom-domain testing uses `*.localtest.me`** (public DNS → 127.0.0.1) instead of a mock resolver in the running app; the test suite swaps `DnsResolver` for fixed answers.

## Phase 11
- **Order lists sort by `order_number`, not `id`.** ANALYZE on 78k orders / 20 tenants: `where tenant_id = ? order by id desc limit 20` made MariaDB walk the primary key backwards through other tenants' rows (38k rows read for a tenant whose orders are old; search read the whole table). `order_number` is the per-tenant sequence (same order as `id` inside a tenant), so `(tenant_id, order_number)` serves the default list and the new `(tenant_id, status | landing_page_id | is_duplicate_suspect, order_number)` indexes serve the filters: every list reads 20 rows, search reads at most the tenant's own orders. The home page is looked up by `home_key = 1` (unique index) instead of `is_home`.
- **Host lookups cached 60 s** (plan section 21) as plain attribute arrays (object unserialization is disabled in `config/cache.php`). Domain `saved` / `deleted` and Tenant `saved` events clear the affected hosts and the primary-host entry, so renames, new primaries and suspensions show at once; the one bulk update (primary falling back on delete) clears explicitly.
- **A disabled theme keeps working for pages already on it** (save and republish allowed); it only disappears from new pages and theme switches, as the plan says. Before, republishing such a page was blocked.
- **Super admin endpoints take numeric tenant ids** (not route-model binding), because tenant-scoped relations are loaded inside `Tenancy::withoutTenant()`; the class carries the audit comment.
- **Password reset** returns a 12-character password (letters, numbers, symbols) once; it is never stored in the audit log, and every token of that owner is deleted.
- **Form token limit** (30 / min / IP): Next now forwards the visitor IP on the GET as well; before, form tokens shared the per-host read limit.
- **Logs**: production uses a `json` channel (stderr, Monolog JsonFormatter) with a `RedactSecrets` processor that blanks values of keys like password / token / secret / key / authorization / cookie / session.
- **Demo data** is built through the real actions (register, product, offer, code, pages, publish, orders through `CreateOrder`, statuses through `ChangeOrderStatus`) so it obeys every rule; it refuses production and is idempotent.
- **E2E runs on its own stack** (`landing_e2e`, Laravel :8011, Next :3100, sync queue): the database is created and migrated by the Laravel web-server command itself, so it is ready before Playwright's readiness probe.
- **Docker**: one back image for back-app / queue / scheduler; an entrypoint runs `php artisan optimize` in each container at start (each has its own filesystem), so config / route / event caches always match the runtime env. nginx only forwards to `public/index.php`; nothing else can execute.
- **APP_KEY** is generated with `openssl` (no need to build an image first); `deploy.sh` refuses placeholder passwords, `SERVER_IP=0.0.0.0` and short shared secrets.
- **Lighthouse** could not be installed here; the metrics it scores (LCP, CLS, long tasks) were measured with the same Chromium under Lighthouse's mobile throttling instead (PROGRESS, final checklist).


## Roadmap v2
- **Abandoned forms are captured 1.5 s after the visitor stops typing a valid phone** (with name, governorate, quantity), only on live pages, deduplicated per change. One open lead per phone + page; a phone that ordered from that page in the last 24 h is not captured; blocked phones / IPs are ignored. The endpoint always answers 202 and needs the page's form token, so bots learn nothing.
- **A lead becomes «طلب بعدها» when the same phone orders on any page of the store** (open or contacted leads), linked to the order. A converted lead can't be moved back by the merchant.
- **Leads are deleted after 30 days** (`leads:prune`, daily): they are data visitors never submitted. The command is an audited `withoutTenant` bypass.
- **Calling or opening WhatsApp on a new lead marks it «تم التواصل»** quietly; the follow-up text is fixed (first name, store, product) rather than a second template setting, to keep settings small.
- **Conversion sections share one markup across themes** (`themes/shared/sections/blocks.tsx`); each theme only picks classes from `looks.ts` (Malak soft, Celia hard borders). A new theme adds one look entry instead of six components. Theme parity tests still cover every type × variant.
- **New pages still start with the ten core sections**; the six conversion sections are added from the Builder library (the parity test now checks the core list).
- **Video is click-to-play**: only a poster until the visitor clicks, then a `youtube-nocookie.com` / `player.vimeo.com` iframe. Only https YouTube, Vimeo and direct `.mp4` / `.webm` links are embedded; anything else hides the section. No API key involved.
- **Countdown**: "fixed" stores Cairo wall time (`YYYY-MM-DDTHH:mm`, a new `datetime` Builder field) and converts with the existing Cairo helpers; "evergreen" starts per visitor on first view (localStorage per section) and is read after hydration so server and client HTML match.
- **The sticky order button is rendered without the scroll-reveal wrapper** (like the header): a transformed ancestor would break `position: fixed`. It hides while `#order` is on screen and is always visible in the Builder preview.
- **Templates live in the front (`themes/templates`) and are sent as the new page's content**; the back validates them like any Builder save, so no new endpoint or table. They carry no images (the page uses the merchant's product images) and no fake orders or reviews beyond sample testimonial text the merchant is expected to replace, like the existing section defaults.
- **A template's colors and fonts are applied as the page-only look** (`content.design`), on by default with a switch in the wizard; turning it off keeps the store identity. Every palette is tested for WCAG AA (button text) and AAA-level body contrast.
- **Template cards show the structure, not screenshots**: the theme's own section wireframes stacked in a phone frame in the template colors, so they stay correct when sections or themes change.
