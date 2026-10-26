# PROGRESS

| # | Phase | Status |
|---|-------|--------|
| 1 | Foundation, register & login | ✅ Done |
| 2 | Identities & media library | ⏳ Next |
| 3 | Products & options | ⬜ |
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
