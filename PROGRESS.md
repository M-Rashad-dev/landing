# PROGRESS

| # | Phase | Status |
|---|-------|--------|
| 1 | Foundation, register & login | ✅ Done |
| 2 | Identities & media library | ✅ Done |
| 3 | Products & options | ✅ Done |
| 4 | Offers, discount codes, price engine | ✅ Done |
| 5 | Page engine & Builder | ✅ Done |
| 6 | Theme «malak» | ✅ Done |
| 7 | Theme «celia» | ✅ Done |
| 8 | Public rendering, SEO, tracking | ✅ Done |
| 9 | Orders & management | ✅ Done |
| 10 | Custom domains & SSL | ✅ Done |
| 11 | Super admin & final hardening | ✅ Done |

---

## Phase 1 — Foundation, register & login ✅

**Back**: Laravel 13 API-only (`/api/v1`, `internal.php` without prefix), JSON error shape `{message, code, errors?}` in Arabic for every error, tenancy core (`TenantContext`, fail-closed `TenantScope`, `BelongsToTenant`, `Tenancy::runAs/withoutTenant`, `TenantExists`/`TenantUnique`), migrations + models + factories for tenants/users/tokens/domains/themes, enums, `config/landing.php`, `PhoneNormalizer`, `SubdomainGenerator`, `RegisterTenant` (tenant + owner + active primary subdomain + token), login by email or phone, logout, me, profile/password/store endpoints, rate limits, middleware aliases, `/health`, `ThemeSeeder`.

**Front**: Next 16 + TS strict + Tailwind v4, RTL Arabic, Cairo from @fontsource, `messages/ar.ts`, API layer (server + client + `ApiError` + 422 → field errors), BFF (`/api/auth/*` with httpOnly `lp_token`, `/api/bff/[...path]` streaming proxy with Origin check and 401 cookie clearing), host-classifying `proxy.ts`, login/register (zod incl. Egyptian phone), dashboard shell (sidebar / mobile drawer / topbar / user menu / logout), settings page, «قريبًا» pages for upcoming sections, UI kit (Button, Input, Label, Textarea, Select, Switch, Checkbox, Card, Dialog, Sheet, DropdownMenu, Table, Tabs, Badge, Skeleton, Toaster, PageHeader, EmptyState, ErrorState, ConfirmDialog, FormField, DataTable + Pagination), simple marketing home page.

**Checks**
- `composer test` → 90 passed · `composer lint` → passed
- `pnpm lint` ✓ · `pnpm typecheck` ✓ · `pnpm test` → 44 passed · `pnpm build` ✓
- `scripts/smoke-auth.sh` (register → dashboard → BFF write with/without Origin → logout → token revoked → login by phone → tenant-host 404) → OK
- DB rows verified: tenant + owner (+20 E.164 phone) + active primary subdomain with `active_host`.

**How to run locally**: see README.md.

## Phase 2 — Identities & media library ✅

**Back**: `media` + `identities` tables, `MediaProcessor` (finfo type check, 5MB / 6000px / min 16px, re-encode without EXIF, orientation fix, 3 WebP variants, favicon icons, random paths, cleanup on failure), media endpoints (list + search + `ids`, multi-upload with 2000/tenant limit and 30/min limiter, alt, delete with 409 + usages), identity endpoints with strict validation (hex colors, font/radius lists, E.164 contact phones, https social links per network, tracking id regexes, conversion event), single default identity rules, default identity on registration, `FrontendRevalidator` + `RevalidateTenantHosts` job, dev-only local media route, tenant isolation suite (`tests/Feature/Isolation`).

**Front**: media library page (drag & drop, per-file progress/errors, search, load more, alt editing, delete with usages dialog), `MediaPicker` (library/upload tabs, single/multiple + max), `MediaField`, `MediaListField` (dnd-kit sortable with keyboard sensor + move buttons), identities list (cards with logo, palette, default badge, actions) and form (collapsible sections: brand, colors with WCAG AA warning, fonts with Arabic sample + radius, SEO with counters + Google preview, contact & socials, tracking with hints/examples/live regex + Lead/Purchase), live `IdentityPreview`, fonts registry + `getFontCss`, color and tracking helpers, dashboard loading/error states.

**Checks**
- `composer test` → 151 passed · `composer lint` → passed
- `pnpm lint` ✓ · `pnpm typecheck` ✓ · `pnpm test` → 70 passed · `pnpm build` ✓
- `scripts/smoke-media.sh` (register → upload 5 real JPEGs via BFF multipart → served at /media → alt (HTML stripped) → identity with logo → delete used image = 409 with usages → make second identity default (exactly one default) → delete unused image → dashboard pages 200) → OK

## Phase 3 — Products & options ✅

**Back**: products / product_media / product_options / product_option_values, `Money` helper (cents), `ProductRequest` (prices, compare-at > price, ≤5 options, unique option names and value labels, swatch colors, ownership of nested ids, ≤10 tenant media), `SaveProduct` nested sync in one transaction, list (search name/SKU, active filter, main image, options count), show, create, update, toggle, duplicate (inactive copy with options and images), soft delete (409 hook for pages), `ProductResource` + `PublicProductResource`, product usage in media delete check, products in the isolation suite.

**Front**: products list (table on desktop / cards on mobile, search, status filter, inline Switch, actions: edit/duplicate/delete, 409 dialog with page links, pagination, empty state), product form page (basics with Markdown write/preview, pricing with live discount %, sortable images with "رئيسية" badge, options builder: sortable options and values with keyboard support, add/duplicate/remove values, swatch colors, price deltas, live customer preview), unsaved-changes guard, nested 422 errors on the right inputs, `Markdown` renderer (no raw HTML, safe links), `safeHref` allow-list, `SortableList`.

**Pending hooks**: all filled (promotions unlink in phase 4; pages usage for products, identities and media in phase 5).

**Checks**
- `composer test` → 188 passed · `composer lint` → passed
- `pnpm lint` ✓ · `pnpm typecheck` ✓ · `pnpm test` → 98 passed · `pnpm build` ✓
- `scripts/smoke-products.sh` (t-shirt with S/M/L/XL + swatch color + 4 images → reorder images, delete two values, rename, reorder values, change delta → verified after reload; duplicate inactive; pages 200) → OK. Auth and media smokes re-run → OK.

## Phase 4 — Offers, discount codes & price engine ✅

**Back**: offers / offer_products / discount_codes / discount_code_products / discount_code_redemptions, enums (OfferType, DiscountType, PromotionStatus), `Offer::scopeActiveAt` (inclusive bounds), `PriceCalculator` + `PriceMath` + `Quote` exactly per 7.1 (options validation, best single offer with tie-breaks, code checks a→g in order with Arabic messages, caps, minimum after offer, per-phone limit ignoring released uses, half-up integer rounding, total ≥ 0), offer and code CRUD with 7.2 rules (percentage ranges, fixed below cheapest product, profitable bundles, end > start, uppercase unique code per tenant, type locked after first use), computed status + SQL status filter, toggles, redemptions log, `POST /dashboard/pricing/preview` with simulated Cairo time, limits (200 offers / 500 codes), product delete unlinks promotions, revalidation on changes, both resources in the isolation suite.

**Front**: Cairo date helpers (DST-aware) with tests, offers page (table/cards, status filter, toggle, delete, dialog form switching fields by type, product multi-select with search, datetime-local "بتوقيت القاهرة" with "بدون نهاية", badge, priority, effective unit price hint for bundles), discount codes page (copy button, random code generator, usage used/limit, redemptions dialog, full form incl. cap/minimum/limits/stackable/products), `PricePreview` simulator on both pages (product, options, quantity, code, simulated time, phone → step-by-step quote).

**Checks**
- `composer test` → 281 passed (PriceMath table + PriceCalculator suite = 53 cases) · `composer lint` → passed
- `pnpm lint` ✓ · `pnpm typecheck` ✓ · `pnpm test` → 103 passed · `pnpm build` ✓
- `scripts/smoke-pricing.sh` ("2 for 350" from tomorrow: not applied now, applied tomorrow; EID25 25% capped at 100; offer + code = 262.5; invalid code → code_error) → OK

## Phase 5 — Page engine & Builder ✅

**Back**: landing_pages + landing_page_media, `PageStatus`, `PageContentSanitizer` (types, uuid ids, variants, visibility, per-type limits, 30 sections / 256KB / depth 5 / 50 items, HTML stripping and length caps, `*_media_id(s)` tenant ownership, `*_url` via `SafeUrl`, `*_color` hex, key whitelist) reporting `content.sections.{i}.props.{path}`, `SafeUrl` + `PageSlug` rules, `CreatePage`, `SavePageContent` (optimistic locking → 409 with current version), `PublishPage` (all blockers at once), unpublish / duplicate (`-copy`, `-copy-2`) / set-home (single, published only) / delete (slug freed), `GET /dashboard/themes`, page settings update with SEO and tracking overrides, `GET /dashboard/pages/{id}/preview` via `PublicPageData`, usage checks for products / identities / media, pages in the isolation suite, themes seeded for every test.

**Front**: themes types + registry (`getTheme`, `getComponent`, `resolveVariant` with safe fallbacks), 10 schemas with Arabic defaults, `_fallback` placeholders (both themes register them until phases 6–7 with their real variant lists), field system (`FieldRenderer` for text, textarea, number, range, toggle, select, color, image, images, link, icon, repeater, group, order_fields, custom_fields; `showIf`), link picker (section anchors/#order, https, phone, WhatsApp), icon set (40), `useOrderForm` contract types, zustand Builder store (pinned header/footer, singletons, 30 max, duplicate, hide, props, variant, theme switch with variant fallback, undo/redo, save state), `SiteRenderer` + `IdentityStyle`, preview route with postMessage protocol (select from preview, scroll from list, hidden sections dimmed), full-screen Builder (sortable sections with keyboard, library dialog with thumbnails, schema forms, variant picker, page settings panel, device switch 390/768/1280 with scaling, autosave + Ctrl+S + beforeunload, conflict dialog reload/overwrite, publish with blockers dialog and "fix" actions, published link dialog, theme switch confirmation, mobile tabs), pages list (cards with link copy, home star, status, unpublished changes badge, actions), creation wizard (theme cards → name/slug auto Arabic-friendly + identity preview + product or quick product), page settings (SEO with Google preview, OG image, noindex, tracking override).

**Checks**
- `composer test` → 348 passed · `composer lint` → passed
- `pnpm lint` ✓ · `pnpm typecheck` ✓ · `pnpm test` → 140 passed (store reducers, anchors, schema naming rules, registry parity) · `pnpm build` ✓
- `scripts/smoke-pages.sh` (create page → builder 200 → preview SSR shows the draft and needs the cookie → publish blocked with no_product + order_form_missing → save v1→v2 with theme switch → stale save 409 version_conflict → javascript: link 422 at its exact path → link product → publish) → OK
- Not verified in a real browser yet (drag & drop, live postMessage updates); covered by the Playwright scenarios planned in phase 11.

## Phase 6 — Theme «malak» ✅

**Front**: the 10 Malak components with every variant from the plan (header centered-logo/logo-start with announcement bar, sticky blur and mobile drawer; hero split/full-cover/centered-card with art-directed mobile image, price + best offer badge, badges, overlay, heights; gallery slider (scroll-snap, thumbnails, autoplay) / grid with lightbox; product showcase card/side-by-side with Markdown description and highlights; features icon-cards/alternating; offers cards/ribbon-banner with live countdown, savings, expiry refresh and "bundle → order form quantity + scroll"; testimonials cards-slider/grid with ratings, avatars and zoomable proofs; FAQ accordion-soft/two-columns; order form card/split-summary on the shared `useOrderForm`; footer simple-center/columns with contact + socials), wireframe thumbnails, shared helpers (see DECISIONS), display-only offer math and local quote estimate, `/dev/themes` review tool with demo fixtures, Playwright installed for screenshots.

**Checks**
- `pnpm lint` ✓ · `pnpm typecheck` ✓ · `pnpm test` → 228 passed (every component × variant of both registered themes renders with full and with completely empty props and no product, no React errors; SafeLink rejects `javascript:`; user HTML is shown as text; unknown variants fall back to the default)
- Visual review via screenshots at 390 / 1280 (+ overflow scan at 390 / 768 / 1280) with violet, dark and green identities → no horizontal scroll; fixed along the way: FAQ group collision across sections, split-summary form width on mobile, highlight contrast on tinted background, old-price contrast on photo heroes.
- Back end unchanged (348 tests from phase 5).

## Phase 7 — Theme «celia» ✅

**Front**: the 10 Celia components (bold & square: hard borders, solid offset shadows, huge type, dark bands) with every variant from the plan — header bar/minimal (marquee announcement, full-screen menu), hero big-type/split-reverse/full-cover (slanted price tag, badge strip), gallery thumbs-side/masonry with lightbox, product showcase split-image/stacked (dark price strip), features numbered-grid/icon-list, offers bundle-tiles ("الأكثر طلبًا" on the biggest saving)/countdown-strip, testimonials quote-wall/screenshots-grid, FAQ accordion-lines/numbered, order form bordered/sticky-summary (mobile bottom bar with total while the form is off screen), footer dark-columns/minimal-line; square wireframe thumbnails; `HeroPicture` moved to shared; new helper classes `.t-hard`, `.t-hard-sm`, `.t-line`, `.t-press`, `.t-stripes`. Both themes now use real components only (`_fallback` stays as a safety net for unknown types). README documents how to add a theme or a component type.

**Checks**
- `pnpm lint` ✓ · `pnpm typecheck` ✓ · `pnpm test` → 231 passed (new parity suite: every type in both themes with ≥ 2 variants, valid default, thumbnail and starter order; a fully filled page rendered in malak then celia keeps every text and every image) · `pnpm build` ✓
- `/dev/themes` → 404 on the production server.
- Visual review via screenshots at 390 / 1280 + overflow scan at 390 / 768 / 1280 with violet, dark and green identities → no horizontal scroll.

## Phase 8 — Public rendering, SEO & tracking ✅

**Back**: `GET /public/resolve-host` (active domains only via `active_host`, status active/suspended, primary host, is_primary, home slug), `GET /public/pages` (published snapshot only, theme from the snapshot, live identity / product / offers / media, merged SEO: page override → identity → product with title suffix, canonical on the primary host, noindex; merged tracking: page override over identity, malformed ids dropped), `GET /public/sitemap` (indexable published pages, home on `/`), all `Cache-Control: no-store`, internal key required, `public-read` rate limit per host, `PublicSite` service + `PlainText::fromMarkdown`, `PUBLIC_SCHEME` / `PUBLIC_PORT` config. Revalidation was already wired in earlier phases for every trigger in the plan (domain changes come with phase 10).

**Front**: tenant host rewrite → `app/sites/[host]/[[...slug]]` (ISR with an empty `generateStaticParams`, data fetched with `revalidate: 60` + tag `host:{host}`), unknown host / unknown slug / nested path → Arabic 404, suspended tenant → «هذا المتجر متوقف مؤقتًا», non-primary host → permanent redirect to the primary host, `generateMetadata` (title, description, canonical, robots, Open Graph ar_EG, Twitter card, favicons 32/180, verification tags) + `generateViewport` (theme color), Product JSON-LD (price after the best active offer, availability, priceValidUntil; `<` escaped), identity fonts only (`@font-face` from bundled files + preload of the body font), `sitemap.xml` and `robots.txt` per host, `TrackingScripts` (official loaders, afterInteractive, valid ids only, ViewContent once all loaders are ready, UTM capture), GTM events only when GTM is loaded, `/api/revalidate` (timing-safe secret, 1–50 tags, immediate expiry). Security headers were already set in `next.config.ts`; the marketing page already existed (phase 1). Visitor texts moved to `messages/site.ts` so public pages no longer ship the dashboard dictionary; `.t-input` moved to a CSS layer so theme utilities (Celia's 2px borders, error borders) apply.

**Checks**
- `composer test` → 363 passed (15 new public API tests: internal key, unknown host, pending custom domain, secondary → primary, suspended tenant, drafts never served, published snapshot vs later draft edits, home page, no internal fields, inactive product, same slug in two tenants, SEO merge, canonical on primary, tracking merge + malformed ids, sitemap) · `composer lint` → passed
- `pnpm lint` ✓ · `pnpm typecheck` ✓ · `pnpm test` → 246 passed (SEO → metadata, Markdown stripping, JSON-LD price + escaping, host parsing / slug depth / primary redirect, track() event table for all tools, GTM-only dataLayer, broken tools ignored, only valid ids get a snippet, revalidate secret + tags) · `pnpm build` ✓
- `scripts/smoke-public.sh` (register → publish a Celia page with SEO + Meta pixel overrides → draft 404 → `http://{sub}.localhost:3000/` and `/smoke-offer` show title, description, canonical, Open Graph, JSON-LD and the pixel → draft edit not leaked → republish visible within seconds through the queue → unknown slug / nested path / unknown host (Arabic) → 404, `/dashboard` and `/sites/...` on a tenant host → 404, sitemap.xml, robots.txt, revalidate with a wrong secret → 401) → OK; `smoke-pages.sh` still OK.
- JS on a public page (modern browsers, gzip, `scripts/measure-public-js.sh`): **166 KB** — React DOM ≈ 71 KB + Next router/runtime ≈ 60 KB (fixed cost of React 19 + Next 16) + theme islands ≈ 35 KB (order form + offers + tracking 18.5 KB, tailwind-merge 8.6 KB, small shared parts). The ~120 KB goal is below the framework's own baseline; it was 177 KB before visitor texts were moved out of the dashboard dictionary.
- Not measured: Lighthouse mobile score (no Lighthouse in this environment). Mobile screenshot of the published page: correct theme, identity fonts, no horizontal overflow. The order form's `/api/public/*` calls 404 until phase 9.

## Phase 9 — Orders & management ✅

**Back**: tables `orders`, `order_items` (options snapshot), `order_status_logs`, `order_counters` (per-tenant numbers from 1001, row lock), `blocked_customers`; FK `discount_code_redemptions.order_id → orders`. Public API (internal key, host-scoped): `GET /public/form-token` (HMAC token tied to the page, valid 3 s – 2 h), `POST /public/quote` (PriceCalculator, page product only), `POST /public/orders` (honeypot + token age → generic `rejected`, blocked phone / IP → same answer, 5 orders / 10 min per IP and 3 per phone, dynamic validation from the published `order_form` settings incl. custom answers, server-side price with the code locked in the same transaction, possible-duplicate flag, idempotency key cached 30 min). Dashboard: list with filters (status, search, page, product, Cairo date range, duplicates, sort) + counts per status, `stats?since=` for the badge, details with customer history, edit customer fields while open, status changes following 7.4 (fake / cancelled release the code use; fake can block phone and/or IP), bulk status, CSV export (UTF-8 BOM, formula-injection guard, max 10,000 rows), blocked customers CRUD, `overview` (today / week / month, delivered revenue, 14-day chart in Cairo days, latest orders, top pages).

**Front**: `/api/public/{form-token,quote,orders}` route handlers (visitor IP from the first `X-Forwarded-For`, 32 KB body limit) wired to the order form; orders page (status tabs with counts, filters in the URL, bulk actions, export, mobile cards), order details (timeline, transition dialog with block options, edit customer, internal note, WhatsApp link, print), blocked customers page, dashboard home overview with a CSS chart, new-order badge + tab title + chime (polling every 30 s, paused in hidden tabs, sound toggle).

**Checks**
- `composer test` → 404 passed (23 public order tests: token / honeypot / blocked / rate limits / dynamic validation / default fields / custom answers / invalid code / limited code / duplicates / idempotency / client IP; 14 management tests: filters, transitions, release of code use, block on fake, bulk, export, stats, overview; orders + blocked customers in the tenant isolation suite) · `composer lint` → passed
- `pnpm lint` ✓ · `pnpm typecheck` ✓ · `pnpm test` → 254 passed (order form fields from settings, zod schema = `validateAll`, default fields equal the back end's, UTM capture, double submit sends one order, preview never sends) · `pnpm build` ✓
- `scripts/smoke-orders.sh` (through Next on `http://{sub}.localhost:3000`: quote 2 × XL with SAVE10 = 630 → too-fast token rejected → order #1001 total 630 → dashboard totals, options snapshot, UTM and client IP → confirmed → delivered → returned (final) → fake + block phone → next order from that phone rejected and SAVE10 use released → 5 concurrent orders on a 2-use code → exactly 2 succeed, unique numbers → stats → CSV with BOM and Arabic header) → OK; `smoke-public.sh` and `smoke-pages.sh` still OK.

## Phase 10 — Custom domains & SSL ✅

**Back**: `DomainRules` (normalize: lowercase, no scheme / path / port / trailing dot, Arabic names → punycode via intl; reject IP, localhost, the platform domain and anything under it, missing dot, bad lengths / labels, a host active at another tenant, the same host twice; limit 10), DNS instructions per domain (root → `A @ → SERVER_IP`, sub/www → `CNAME → cname.{PLATFORM_DOMAIN}`, known two-part suffixes like `com.eg` handled, Cloudflare warning), `DnsResolver` interface + `NativeDnsResolver` (`dns_get_record`), `DomainVerifier` (CNAME match or any matching A record; Arabic errors «لم نجد السجل بعد» / «السجل يشير لعنوان آخر: …»; activation in a transaction with a row lock + unique `active_host`, then `WarmSsl` + `RevalidateTenantHosts`), `domains:verify-pending` every 5 min (pending < 72 h, 100 per run, as queued `VerifyDomain` jobs; older → failed), `WarmSsl` (GET `/api/health` with TLS verification, 6 tries 20 s apart → issued / unknown), `GET /internal/tls/ask` (platform hosts + active hosts of active tenants, read only, 60/min), dashboard endpoints: list with instructions, add custom (checked at once), verify (10/min per tenant), check-ssl, make-primary (active only, one primary), delete (custom only; primary falls back to the subdomain), rename subdomain (7.6 rules, old name released, old + new hosts revalidated), live label availability.

**Front**: `/dashboard/domains`: free subdomain card (link, copy, open, make primary, rename dialog with a debounced availability check), custom domains card (status + SSL badges, last check / error / attempts, verify now, DNS help, SSL re-check, make primary, delete with confirmation), the redirect-to-primary note, and a 3-step wizard (host with live normalization → exact DNS record with copy buttons, provider tips for GoDaddy / Namecheap / Hostinger / Cloudflare / .eg and the Cloudflare warning → status with «تحقق الآن», polling every 15 s for up to 5 min, then the option to make it primary). Page links in the dashboard, page list and builder use the session's public scheme / port, and refresh after primary changes.

**Deploy**: `deploy/Caddyfile` (on-demand TLS with the ask endpoint, HTTP → HTTPS, `/media/*` from the volume, everything else to Next) and the custom-domain section of `deploy/DEPLOY.md`. **Untested** (no Docker on this machine).

**Checks**
- `composer test` → 442 passed (domain tests: normalization incl. Arabic, each rejection rule, duplicates + limit, root vs sub instructions, verifier CNAME ok / A ok / A wrong / CNAME wrong / no record, activation + jobs, manual verify, two accounts racing for one host (one wins; the DB unique index refuses a second active row), verify rate limit, TLS ask for platform / active / pending / suspended tenant / unknown hosts, scheduler + expired → failed, WarmSsl issued / released / unknown, subdomain rename + availability, make-primary + resolve-host redirect + delete primary, 401s; domains added to the tenant isolation suite) · `composer lint` → passed
- `pnpm lint` ✓ · `pnpm typecheck` ✓ · `pnpm test` → 267 passed (host normalization with the same cases as PHP, label rules, site URLs; wizard: exact DNS record + Cloudflare warning, polls every 15 s until active, stops after 5 min) · `pnpm build` ✓
- `scripts/smoke-domains.sh`, **real DNS, no mocks** (`*.localtest.me` → 127.0.0.1 = local `SERVER_IP`): connect `d{stamp}.localtest.me` → active at once → redirects to the subdomain while not primary → make primary → page served on the custom domain with its canonical, old subdomain 308 → custom domain → TLS ask (custom / subdomain / platform 200, unknown 404) → two accounts add the same host concurrently → exactly one owns it → rename subdomain (old name 404) → delete the primary custom domain → subdomain primary again, custom host 404 → OK. `smoke-orders`, `smoke-public`, `smoke-pages` still OK. `domains:verify-pending` listed in `schedule:list` and run by hand. Locally `WarmSsl` marks a domain issued over plain http (reachability only).
- Screenshots of `/dashboard/domains` and every wizard step at 1280 px and 390 px: no horizontal overflow.
- Not tested: real certificates from Let's Encrypt through Caddy (needs the VPS; steps in `deploy/DEPLOY.md`).

## Phase 11 — Super admin & final hardening ✅

**Super admin**: `platform:create-admin` (interactive, password not echoed, refuses duplicates); `/api/v1/admin/*` (overview, tenants with search + status filter and page / order counts, tenant details with domains, suspend with a reason → tokens revoked + sites revalidated, activate, owner password reset → 12 characters shown once + sessions ended, themes on/off) behind `EnsureSuperAdmin`; every action in `admin_audit_logs` (who, what, target, IP). Front `/admin` (same login, redirect by role): overview cards, tenants table + mobile cards, tenant page (suspend dialog with reason, activate, reset dialog with copy + warning), themes with switches. A disabled theme no longer blocks pages already on it (save + republish); it only disappears for new pages and switches.

**Hardening**: limits checked against section 21 (new: form token 30 / min per visitor IP); review of every `withoutTenant` (all commented, all tested), plain `exists:` / `unique:` (only on platform tables: users, themes), `$guarded` → explicit `$fillable` on Order, raw SQL (no user input), `dangerouslySetInnerHTML` (JSON-LD escaped, font CSS from a whitelist); EXPLAIN / ANALYZE on 78k orders → order lists sort by `order_number` with new `(tenant_id, status|landing_page_id|is_duplicate_suspect, order_number)` indexes, home page by `home_key`; host and primary-host lookups cached 60 s with model-event invalidation; Arabic `error.tsx` / `not-found.tsx` / `global-error.tsx` for the dashboard, admin, builder, public sites and the root; `json` log channel (stderr, Monolog JSON, secrets redacted); `DemoSeeder` + `platform:demo` (refuses production); no TODO / console.log / dd.

**Tests**: full API flow test (register → identity → product with options → offer + code → page → publish → resolve → quote → order → statuses → export); Playwright E2E (`pnpm e2e`, isolated `landing_e2e` + ports 8011 / 3100); `scripts/load-test.mjs`; `scripts/smoke-admin.sh`.

**Deploy** (written, **untested**: no Docker on this machine): `docker-compose.yml` (8 services, only Caddy publishes 80/443, health checks, json-file logs 10m × 3, `service_healthy` dependencies), `back/Dockerfile` (composer `--no-dev` → php 8.3-fpm-alpine with gd/intl/bcmath/pdo_mysql/opcache/pcntl/zip/redis, non-root, entrypoint caching config / routes / events in every container), `back/docker/{nginx.conf,php.ini,www.conf}`, `front/Dockerfile` (standalone, non-root, env read at runtime), root `.env.example`, `deploy/deploy.sh` / `backup.sh` / `restore.sh`, full Arabic `deploy/DEPLOY.md`, `docs/ARCHITECTURE.md`.

**Checks**
- `composer test` → **477 passed** (2009 assertions) · `composer lint` → passed
- `pnpm lint` ✓ · `pnpm typecheck` ✓ · `pnpm test` → **269 passed** · `pnpm build` ✓
- `pnpm e2e` → **6 / 6 passed** (36 s)
- Smoke: auth, media, products, pricing, pages, public, orders, domains, admin → all OK
- Load test: 50 concurrent visitors × 10 rounds = 500 page views, 0 errors (316 req/s, p95 436 ms); 100 orders at 10 / s → 100 × 201, numbers 1001–1100 unique (p95 85 ms)
- `composer audit` → no advisories (3 abandoned packages, all from dev-only `laravel-lang/common`, not in the production image) · `pnpm audit` → no known vulnerabilities
- Screenshots of `/admin`, tenants, tenant details and themes at 1280 px and 390 px: no horizontal overflow

## Final checklist (PLAN section 22)

**Features**
- ✅ Register → random active subdomain + default identity (`smoke-auth`, `RegisterTest`, E2E 1).
- ✅ Upload images, two identities, product with options, offer, discount code (`smoke-media`, `smoke-products`, `smoke-pricing`, E2E 2, full-flow test).
- ✅ Page built in both themes, switching without losing content, published (`smoke-pages`, theme parity tests, E2E 3 + 6).
- ✅ Published page on the subdomain with SEO, JSON-LD and only valid tracking codes (`smoke-public`, `PublicSiteTest`).
- ✅ Order with options, quantity and code; same numbers in the dashboard (`smoke-orders`, full-flow test, E2E 4–5).
- ✅ Every order status and transition, blocking, code release, export, in-dashboard notification (`OrderManagementTest`, `smoke-orders`; badge / chime covered by phase 9 tests).
- ✅ Custom domain (real DNS through `*.localtest.me`, no mocks) and redirect to the primary (`smoke-domains`, `DomainTest`).
- ✅ Super admin: create, suspend / activate, reset password, theme on/off (`AdminTest`, `smoke-admin`).

**Quality and security**
- ✅ Back, front and E2E tests green; lint, typecheck and build green.
- ✅ Tenant isolation covers every dashboard resource (`TenantIsolationTest`, incl. orders, blocked customers, domains).
- ✅ No plain `exists:` / `unique:` on tenant tables; every `withoutTenant` commented and tested.
- ✅ No TODO, mock, console.log or dd() in code (grep).
- ✅ `composer audit` / `pnpm audit`: no high (or any) vulnerabilities.
- ✅ No secrets in the repository (`.env` files ignored; secrets generated locally under ignored `tools/`); root and app `.env.example` complete.
- ⚠️ Lighthouse mobile ≥ 90 on both themes: **not measured** — installing the Lighthouse CLI was not allowed in this environment. Measured instead with the same Chromium under Lighthouse's mobile conditions (Pixel 7, slow 4G 150 ms / 1.6 Mbps, 4× CPU, median of 3, `front/scripts/perf-check.mjs`): Malak LCP 1.21 s, CLS 0.001, long-task time 162 ms; Celia LCP 1.26 s, CLS 0.000, long-task time 131 ms (targets: LCP < 2.5 s, CLS < 0.1, TBT < 200 ms). Run Lighthouse on the server after deploying to record the score.

**Deploy**
- ⚠️ `docker compose build` for every image: **not run** (no Docker on this machine).
- ⚠️ `deploy.sh` from scratch on a clean machine: **not run**; scripts pass `bash -n`, compose file parses and only Caddy publishes ports.
- ⚠️ `backup.sh` / `restore.sh`: **not run** (need the Docker stack).
- ✅ `DEPLOY.md` covers every step (requirements, server, DNS, `.env`, deploy, admin, checks, custom domain, update / rollback, backup / restore / monitoring, troubleshooting, Let's Encrypt limits).

First thing to do on a real server: follow `deploy/DEPLOY.md` with Let's Encrypt staging enabled, run `./deploy/deploy.sh`, then `./deploy/backup.sh` and a `restore.sh` on a copy, and record the results here.

## Roadmap v2 (see ROADMAP.md)
| Step | Done | Commits |
|---|---|---|
| 0 Theme fixes | Celia FAQ animates, Embla testimonials slider, scroll reveal, sticky header | `fad47a6` |
| 1 Design system «لازورد» | tokens in `globals.css`, Plex Arabic + Readex Pro, grouped sidebar, searchable Select (cmdk), date picker, motion | `6cf1d20`, `da0d8dd` |
| 2 Builder | device switch morphs, page-only identity with live preview | `539b22c` |
| 3 Orders | A4 invoice + A6 label (barcode, bulk print), WhatsApp template + call-center queue, customer `/track` page | `e4eded7`, `928e7da` |
| 4 Selling | delivery fee per governorate, one-click post-order upsell, abandoned order forms («الطلبات المتروكة») | `ef05972`, `50c09a1`, `6b6465c`, this commit |

| 5 Pages (part 1) | six conversion sections in both themes: video (click-to-play YouTube / Vimeo / mp4), before / after (drag slider or two images), size chart (table or cards), comparison (check table or versus cards), countdown (fixed Cairo time or per visitor), sticky mobile order button | this commit |

| 5 Pages (part 2) | template gallery «القوالب الجاهزة» (sidebar → الصفحات): six niche templates (fashion, beauty, electronics, home, kids, health) with copy, sections and a page look; the new-page wizard starts from a template or a blank theme | this commit |

| 6 Measure | analytics per page (visits, form starts, orders, conversion, revenue, sources, devices, daily chart) and A/B tests between two whole pages of the same product on one link; also: first published page becomes home automatically | `1903ea3`, this commit |

| 7 Connect | «Google Sheets و Webhooks» (sidebar → الربط): signed webhooks for order created / status changed / updated and abandoned forms, retries with a delivery log; Google Sheets through the merchant's own Apps Script web app (code to copy, rows upserted by order number) | this commit |

| 5 Pages (part 3) | third theme «ليالي»: night luxury (dark page from the store colors, glass, gradient headlines, glows), all 16 section types × 2 variants, plus a luxury template (perfumes / gifts) | this commit |

«ليالي», verified in the browser: wizard → «عطور وهدايا فاخرة» → builder → publish → public page renders dark (computed background rgb(12,11,10)) on mobile and desktop with no horizontal scroll; every theme × type × variant renders in tests. Front 448 tests, back 544.

Integrations, verified in the browser: wrong Sheets link refused with an example of the right one; webhook saved through the dialog; «إرسال تجربة» made a real HTTPS request (DNS-pinned) to example.com, logged as 405 with the Arabic reason; no horizontal scroll at 390 px. Back 544 tests, front 379.

A/B, verified in the browser: test created in the UI between the fashion and beauty template pages → 16 fresh visitors on page A's link split 8 / 8, URL unchanged, same page on reload → an order from B is stored with the test id → A/B card and analytics screens show the counts; no horizontal scroll at 390 px. Back 526 tests, front 376.

Templates, verified in the browser: gallery → «استخدم القالب» → wizard (template look on) → builder opens with the template sections and colors → publish → all six public pages render (200, template headline as h1). Front 372 tests.

Conversion sections, verified in the browser on both themes (390 px): video loads the youtube-nocookie player only after the click, the before / after divider follows the range input, the sticky bar shows after the first screen and hides while the order form is visible, countdown ticks (evergreen). Back 508 tests, front 358.

Abandoned forms, verified in the browser: phone typed on the demo store → `/api/public/leads` 202 → row in «الطلبات المتروكة» with the WhatsApp follow-up message filled → «تم التواصل» moves it to its tab. Back 507 tests, front 283.


## v3 — plans, payments, stores (docs/features)
| Feature | Done | Commits |
|---|---|---|
| Plans | basic / pro / max with monthly + yearly prices and discounts, free trial (admin), entitlements enforced on every create and public path, locks after a downgrade, expired = sites closed + read-only dashboard, admin plan editor + trial settings + per-store grant / extend / overrides, pricing page (dashboard + marketing), my plan page with usage and «choose what stays live», upgrade dialog, trial / renewal banner, platform badge | `2caad3f`, `be663ea`, `d3a134e`, this commit |

Plans, verified: back 629 tests, front 464 tests, e2e 7 (new: the free trial stops at 5 products, the dialog leads to the pricing page).
| Payments (manual) | invoices with the fixed amount, InstaPay / wallet transfer + receipt upload, admin review (approve starts the plan, reject with a reason), refunds within 3 days, payment methods and support contact in the admin, «الفواتير» + checkout pages, legal pages | `a63c070`, this commit |

Payments, verified: back 649+ tests, front 468, e2e 8 (new: the trial store pays by InstaPay, the admin approves in the UI, Pro starts).
| Theme store | «ثيماتي» (free + owned, newest paid), «متجر الثيمات» (kind / tag / price filters, search, sort), theme page (gallery, features, price + discount, preview, buy / upgrade / use), live preview with sample content, buying through invoices, Basic keeps owned paid themes editable but not served, wizard / builder lock unowned themes, admin catalog (details, images, tags) and gifts; Malak free, Celia 100, Layali 150 | `778bda2`, this commit |

Theme store, verified: back 665 tests, front 473, e2e 9 (new: paid theme locked in the builder; the Pro store previews, buys Celia, the admin approves, it shows as owned).
| Stores | one online store per tenant owning "/" (Pro / Max): categories tree, store fields on products (link, short text, featured, categories, SEO, stock: unlimited / product / per combination, option values that lower the price), store home edited in the Builder with four store sections (banner slider, category grid, product grid, promo banner), menus, static pages with policy templates, storefront (listing with filters / sort / search, category pages, product page with stock, cart in the browser, one-page checkout with shipping and codes), multi-line orders with stock taken and given back, abandoned carts, pixels (AddToCart, InitiateCheckout, Purchase), JSON-LD + sitemap, store analytics; store themes «رواق» (free) and «ديوان» (paid, 200) | `dca7e46`, `51498d6`, `bb5cc8c`, this commit |

Stores, verified: back 678 tests, front 711, e2e 10 (new: the Pro store opens its store, a visitor adds two products from the cards, checks out, the merchant sees one store order), `scripts/smoke-store.sh` PASS.
