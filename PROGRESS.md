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
| 9 | Orders & management | ⏳ Next |
| 10 | Custom domains & SSL | ⬜ |
| 11 | Super admin & final hardening | ⬜ |

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
