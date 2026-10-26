# PROGRESS

| # | Phase | Status |
|---|-------|--------|
| 1 | Foundation, register & login | ✅ Done |
| 2 | Identities & media library | ✅ Done |
| 3 | Products & options | ⏳ Next |
| 4 | Offers, discount codes, price engine | ⬜ |
| 5 | Page engine & Builder | ⬜ |
| 6 | Theme «malak» | ⬜ |
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
