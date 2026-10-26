# PROGRESS

| # | Phase | Status |
|---|-------|--------|
| 1 | Foundation, register & login | ✅ Done |
| 2 | Identities & media library | ✅ Done |
| 3 | Products & options | ✅ Done |
| 4 | Offers, discount codes, price engine | ✅ Done |
| 5 | Page engine & Builder | ✅ Done |
| 6 | Theme «malak» | ⏳ Next |
| 7 | Theme «celia» | ⬜ |
| 8 | Public rendering, SEO, tracking | ⬜ |
| 9 | Orders & management | ⬜ |
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
