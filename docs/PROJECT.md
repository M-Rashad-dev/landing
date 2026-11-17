# PROJECT.md — everything about this project (read this first)

> **Who this is for:** an AI agent (or developer) taking over this repository mid-flight.
> After reading it you should be able to continue exactly as the previous agent did: same
> product knowledge, same agreements with the owner, same habits, same next steps.
> Snapshot date: **2026-11-14**, branch **`v4`**.
>
> Companion files (keep them true when you change things):
> - [`CLAUDE.md`](../CLAUDE.md) — the short non-negotiable rules (loaded automatically by Claude Code).
> - [`DECISIONS.md`](../DECISIONS.md) — the full log of every decision, newest at the bottom of each section. This file
>   summarises it; DECISIONS.md has the exact edge cases. **Add a line there for every new decision.**
> - [`deploy/DEPLOY.md`](../deploy/DEPLOY.md) — the VPS guide in Arabic (stack overview + step-by-step deploy).
> - [`PLAN.MD`](../PLAN.MD) — the original v1 specification (landing pages era). Historical; where it disagrees
>   with this file or DECISIONS.md, they win.

---

## 0. TL;DR

- **Product**: a multi-tenant SaaS for Egyptian merchants, **an online-store platform like Salla / Zid**
  (the store is the core), with **landing pages as a side marketing tool**. Arabic only, RTL, EGP only.
  Brand name **«مكسب» / mksab** (`config/brand.ts`); the owner's logo files are in `front/public/brand` (horizontal, symbol, vertical, tab icons), drawn by `components/brand/logo.tsx`.
- **Stack**: Laravel 13 API (PHP 8.3) in `back/` + Next.js 16 (React 19, TS strict, Tailwind 4) in `front/`.
  MySQL 8 + Redis in production, Laravel Reverb for realtime, Caddy for HTTPS (on-demand TLS for merchant domains),
  everything in Docker Compose on one VPS.
- **State**: feature-complete for a first production test. Deployed once to the owner's VPS
  (`https://13.140.220.40.sslip.io`). All work is pushed to `v4` and `main`.
- **Now**: the **notifications system on WhatsApp** (part 1 done: sending, codes, webhook, forgot password, admin page;
  part 2: the bell, store-owner/admin notifications, email; part 3: customer order messages — all done, waiting on Meta's template review). Then paid plans / online payment, then
  more paid themes (owner's designs) — see §12.
- **The owner**: talk to him in **short Egyptian Arabic**, build **one part at a time and stop for his review**,
  never use an external service without his approval, push every commit (v4 + main) but never deploy to the server yourself. Details in §1.

---

## 1. The owner and how to work with him (most important section)

The owner is Mohamed Rashad, a developer-entrepreneur building this platform to sell. He reviews everything in the
running app himself and is detail-oriented about UX.

### Communication
- **Reply in Egyptian Arabic (عامية مصرية), short and concrete.** Technical words (Reverb, BFF, commit) stay in English.
- At the end of each part: a short report — what was built, how to try it (URLs, buttons), what was tested and
  how, what was found and fixed on the way, open questions. Then **stop and wait** for his review.
- During long unattended work, drop a 1–2 line status update after each sub-task (he glances in).
- If something is ambiguous and changes the outcome, ask (he prefers a short question to a wrong build).
  If it has a sensible default, decide, build, and mention it.
- When he sends screenshots of bugs, fix exactly what he points at, find the root cause, and mention any
  related problems you found.

### How features are agreed
- Big features start with a **plan message** (what exactly will be built, decisions he must take, options with a
  recommendation). He trims or edits it, then says «ابدأ» / «اكمل العمل».
- UI work: **no design images any more** (owner, 2026-11-15) — build the screen directly in the real app, matching
  the design system; he asks for changes after. He explicitly does **not** want a generic "AI look".
- Sizeable work is split into parts (e.g. «صوفي» = back end + storefront, then the Builder forms, then the theme
  pages); stop after each part.

### Hard rules he set (also in CLAUDE.md)
- **External services only with his approval** (propose with the reason first). Approved so far: payment gateway
  (Paymob, not built yet), `compressly` (browser image compression), Recharts, Laravel Reverb (self-hosted),
  Google Maps embed links (no API key), YouTube/Vimeo embeds, **Meta WhatsApp Cloud API** (codes + notifications). Keys live in `.env` only, behind our own interface,
  with a fake for tests.
- **Eloquent / query builder, never raw SQL.** Speed and security matter a lot.
- **Tenancy**: `TenantExists` / `TenantUnique` (never plain `exists:` / `unique:` on tenant tables);
  `Tenancy::withoutTenant()` only in audited places with a comment and a test.
- **Feature tests for every endpoint**: success, validation, 401, tenant isolation.
- **Every Arabic string in `front/src/messages/ar/*.ts`**, RTL logical classes only.
- **No TODOs, mocks or fake data left in code** (sample data is allowed only where it is the product: the platform
  home demo, theme showcase stores, ready page templates).
- **No legacy compatibility code**: change/rename/delete in place instead of keeping parallel endpoints.
- **Commits**: one per finished part, message ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Every commit is pushed right away** (owner, 2026-11-14: «مش عاوز اي commit بدون push»): `git push origin v4` and fast-forward `main` (`git push origin v4:main`), which he deploys from. Never force-push.
- **Browser checks** use a **throwaway tenant** (registered by script, e.g. name "Sufi Smoke") that is **deleted
  afterwards** with its files. Never save the owner's demo store design/products (he tests on the same local stack
  at the same time — it broke his Builder once). Read-only looks at the demo account are fine.
- **Migrations**: run once, carefully; on MariaDB use `dateTime` for required times. Tell him if the dev DB was
  briefly broken.
- The production database must start **clean** (migrations + base seeders + his admin only, no demo data).

### Things he decided NOT to do (don't propose again unless he asks)
- No knowledge-base / help articles in support, no internal notes, merchants never see which admin answered.
- No "sign in as the merchant" for the super admin (not approved).
- No polling for realtime (that is why Reverb exists).
- No video uploads in theme sections (links only — protects the platform's bandwidth/storage).
- No cart drawer in the storefront; no currency setting (EGP only); no menus/identity pages (themes own them).
- Support chat: images/videos are shown as files; images open in an in-page lightbox, videos as file chips that
  open in a modal player.

---

## 2. The product

### Who uses it
| Role | Where | What |
|---|---|---|
| **Merchant** (tenant owner) | `APP_HOST` → `/dashboard` | runs the store, orders, products, marketing, landing pages, settings, billing |
| **Customer** (shopper) | merchant's host (free subdomain or custom domain) | store pages, cart, checkout (COD), account by phone + OTP, tracking, reviews; landing pages |
| **Super admin** (the owner) | `APP_HOST` → `/admin` | stores, payments/receipts, refunds, plans, themes, platform pages, support, activity log, settings |
| **Visitor** | `PLATFORM_DOMAIN` | marketing home page + about/terms/privacy/refund/acceptable-use |

### Business model
- **All plans are paid** (seed prices, editable in admin): **بيسك 50 / برو 100 / ماكس 150 EGP monthly**,
  600 / 1200 / 1800 yearly. Free **trial for new sign-ups: 14 days of Basic** (trial plan and length set in admin).
- **Basic has NO store** (landing pages only); Pro and Max have the store and `buy_themes`. Limits per plan
  (products, landing pages, custom domains, media MB, offers, codes, webhooks, A/B tests, upsells…) live in the
  admin; platform hard ceilings in `config/landing.php` (products 10,000, media 30,000).
- **Paying the platform today = manual transfer** (InstaPay / mobile wallets): the merchant uploads a receipt, the
  owner approves or rejects with a reason. Paymob (cards/wallets) is approved but waits for an account.
- **Themes**: free («أساس» store, «بداية» landing) + **paid themes bought once and kept forever with updates**
  («صوفي» store, 990 EGP placeholder; «شابع» food landing, 100 EGP starting price — the owner changes prices in
  admin). Publishing/serving a paid theme needs a plan with `buy_themes`.
- Refunds: themes never; a plan within 3 days (manual, at most once per 180 days). Upgrade within 7 days pays the
  difference. Expiry: 24 h grace, then sites close to visitors and the dashboard is read-only; **nothing is ever
  deleted**; paying restores everything. Downgrade: over-limit items get `locked_by_plan`.
- Store customers pay **cash on delivery only** (online customer payment is a later phase).

### Hosts (one Next app serves all, routed by `front/src/proxy.ts`)
| Host | Serves |
|---|---|
| `PLATFORM_DOMAIN` (e.g. `platform.com`) | `/` → `app/platform` (marketing), `/{slug}` → platform pages; other paths behave like the app host |
| `APP_HOST` (`app.platform.com`) | `/login`, `/register`, `/dashboard/*`, `/admin/*`, Builder, `/api/auth/*`, `/api/bff/*` |
| any other host | a merchant site: rewritten to `app/sites/[host]/...` (store under `(store)`, landing pages under `(landing)/[slug]`); A/B split happens here |

Free store hosts are `{subdomain}.{PLATFORM_DOMAIN}`; custom domains are verified by DNS (A for root, CNAME to
`cname.{PLATFORM_DOMAIN}` for sub/www) and get certificates on demand.

---

## 3. What exists today (feature inventory)

Every item below is built, tested and was reviewed or is waiting for the owner's review.

### Merchant dashboard (`/dashboard`, sidebar in `front/src/config/navigation.ts`, all `ready`)
- **الرئيسية**: period KPIs vs previous period, chart, «محتاج منك دلوقتي» (to confirm, stale shipments, abandoned,
  stock, ending promotions), **«جهّز متجرك» checklist** (product, shipping on with an active company, store live;
  custom domain optional with **«تخطي»** saved in `tenants.settings.setup_skipped`).
- **الطلبات**: status tabs (new → confirmed → shipped → delivered; cancelled, fake, returned, damaged shown under
  returned), filters, export CSV, bulk status, quick view, order page (edit customer, tracking number, internal note,
  contact attempts, status log with notes, WhatsApp, printable invoice), **confirmation queue** (`/orders/confirm`),
  landing-page tag on orders.
- **الطلبات المتروكة**: landing forms, store checkouts, carts (by cart token).
- **العملاء**: one per phone per store, segments (repeat, risky, blocked), customer page; **المحظورين** with
  automatic blocking rules (`config/landing.php → auto_block`).
- **التقييمات**: product reviews (only buyers of delivered orders; publish at once; merchant can hide).
- **المنتجات**: cards with quick edit, stock tabs, bulk actions, full form (images, options, per-combination stock,
  main category, auto SEO); **استيراد** from Excel/CSV (auto column mapping incl. Shopify/Woo/Salla/Zid, background
  job, failures table + downloadable xlsx). **التصنيفات**: 5-level drag tree.
- **الشحن**: shipping companies with per-governorate fees / not served, fees on/off switch (first company turns it
  on; warning when companies exist but fees are off), shipping offers.
- **المتجر** (`/dashboard/store`): enable/disable, what still blocks the store.
- **الثيم والرئيسية** (`/dashboard/design/theme`): «ثيماتي» (owned themes, active one → تخصيص / معاينة, others →
  شغّله على متجري), «ثيمات مدفوعة» (not-owned paid themes → their page). **Theme page**
  `/dashboard/design/themes/{key}` (shots, about, features, tags, price/discount, buy/switch/customize, «معاينة الثيم»).
  **Showcase store** `/dashboard/design/themes/{key}/demo` (full screen, desktop/phone, light/dark).
  **Builder** `/dashboard/design/builder` + full preview `/dashboard/design/preview`.
- **الصفحات الثابتة**: Markdown pages with SEO, drag order, 7 ready templates.
- **التسويق**: العروض (5 product offer types + shipping offers), الكوبونات (percent/amount/free shipping, first order,
  min qty, categories), عروض ما بعد الطلب (upsells, shown on thank-you pages), **صفحات الهبوط** (list with 30-day
  stats, create from theme «بداية», landing Builder `/dashboard/landings/{id}/builder`, page settings, **A/B tests**).
- **التحليلات**: store analytics (first-party counters, funnel, sources, devices, products, governorates, hours).
- **الإعدادات**: account, store settings, **الباقة والفواتير** (plans, usage, invoices, checkout `?plan=` or `?theme=`),
  domains, **الربط** (Google Sheets via Apps Script, webhooks), **البيكسلات** (one set for the store, one for all
  landing pages or reuse the store's).
- **Support chat bubble** (bottom corner on every dashboard page).
- `/dashboard/components`: the component showcase (every UI component and its states). New components go here first.

### Storefront (merchant host, `app/sites/[host]/(store)`)
Home (theme sections), `/products` (+search), `/offers`, `/categories/{slug}`, `/products/{slug}`, `/cart`,
`/checkout` (COD, shipping company, coupon, optional email), `/checkout/done` (+ upsell), `/track`,
`/account` (phone + OTP login, orders, addresses, profile), `/pages/{slug}`, sitemap/robots, 404, paused page,
**«المتجر لسه بيتجهز»** page when the store is not live (with owner steps + dashboard link). Pixels: Meta, TikTok,
GA4, GTM, Snapchat (ViewContent, AddToCart, InitiateCheckout, Purchase).

### Landing pages (merchant host, `app/sites/[host]/(landing)/[slug]`)
One product per page, theme «بداية», order form (exactly one), thank-you `/{slug}/done`, abandoned-form capture,
page counters, A/B split in the proxy.

### Super admin (`/admin`)
Overview (stores, subscriptions, money, store sales vs last month), **المتاجر** (filters, store page: numbers, owner,
domains, subscription — give plan / extend / overrides / history, themes, audit, suspend with reason, temp password),
**الدعم** (inbox + performance tab), **المدفوعات** (receipt review with image, repeated transfer warning, approve /
reject with reasons), **الاسترداد**, **وسائل الدفع**, **الباقات** (editor + trial/grace/invoice/support settings),
**الثيمات** (store details, price + dated discount, min plan, tags, screenshots), **صفحات المنصة** (Markdown editor),
**سجل العمليات**, **الإعدادات** (email alerts: new receipt, refund request, new store, new support ticket, daily
summary 09:00 Cairo).

### Platform site (`PLATFORM_DOMAIN`)
Marketing home (`app/platform`, `features/marketing/`): interactive dashboard demo (sample coffee store «حَبّة»,
fixed seed), real prices from `GET /plans`, in-house motion (reveal, count-up, tilt, smooth wheel scroll).
Platform pages `/about`, `/terms`, `/privacy`, `/refund-policy`, `/acceptable-use` (Markdown from `platform_pages`,
edited in admin; starting text has company details in [brackets]).

### Support chat (merchant ↔ «الدعم»)
Tickets numbered id+1000; max 2 open per store, a new one only 12 h after the last open one started (closed ones
never block); 12 idle hours after support's reply → auto close (`support:close-idle`); support can close/reopen;
rating after close (stars, solved?, comment). Images ≤10 MB, videos ≤50 MB, 5 per message, private disk.
Realtime via **Laravel Reverb** (private channels `support.tenant.{id}`, `support.admin`, auth through the BFF).
Works even when the plan expired.

---

## 4. Architecture

```
browser ──https──▶ Caddy (80/443 only)
                     ├── /media/*                → media volume (public images, no PHP)
                     ├── /app/*,/apps/* on APP_HOST → reverb:8080 (WebSocket)
                     └── everything else         → Next (front:3000)
                                                      │ BFF (/api/bff/*) + visitor routes (/api/public/*)
                                                      ▼  bearer token / X-Internal-Key
                                                  nginx (back-web) → php-fpm (back-app, Laravel)
                                                      │
                                               MySQL 8 · Redis
queue (Laravel worker)  · scheduler (schedule:work) · reverb (WebSocket server)
Laravel → POST {front}/api/revalidate (secret) to purge Next's cache tags after changes
```

- **Laravel is never exposed** to the internet; only Next (and Caddy's TLS `ask` on the Docker network) reach it.
- **Auth**: Next route handlers keep the Sanctum token in the httpOnly cookie `lp_token`; JS never sees it. Bearer
  tokens only, 30 days. `/api/bff/[...path]` forwards to Laravel (`dashboard/*`, `admin/*`, `auth/*`,
  `broadcasting/*` only) with an Origin check on non-GET (CSRF). Super admin → `/admin`; merchants → `/dashboard`.
  Customer accounts: cookie `as_customer` on the store host → `X-Customer-Token`.
- **Tenancy (fail-closed)**: every tenant table has `tenant_id` + `BelongsToTenant`; the global scope adds
  `tenant_id = ?` or `1 = 0` when no tenant is set. Tenant comes from the token's user on dashboard routes
  (`ResolveTenantFromUser`, runs before route-model binding) and from the active domain on public routes
  (`PublicSite`, then `Tenancy::runAs`). Cross-tenant ids → 404. `tests/Feature/Isolation` covers every resource.
- **Public pages**: rendered by Next server components with the classic fetch cache (`revalidate` + tags
  `host:{host}`); Laravel's `RevalidateTenantHosts` job hits `/api/revalidate` after anything that changes a site.
  Cache Components are **off**. Host lookups cached 60 s in Redis. Non-primary hosts 308 to the primary.
- **Prices**: `decimal(12,2)` in DB, integer cents in code (`App\Support\Money`). **`App\Pricing\PriceCalculator`**
  is the only authority for customer prices (offers, bundles, codes, shipping); the cart in the browser is display
  only, every price comes from the server quote, the order recomputes everything. Platform billing prices:
  `BillingPriceCalculator`.
- **Entitlements**: `App\Billing\Entitlements` is the only answer to "is this allowed / how many left"
  (plan values + admin overrides; keys are enums `PlanFeature`, `PlanLimit`). Refusals are 403
  `plan_limit_reached` / `plan_feature_locked` / `subscription_expired`; the dashboard shows one upgrade dialog.
  Session (`/auth/me`) carries the plan features; `usePlanFeature(key)` on the front.
- **Queue jobs**: revalidation, webhooks (retries 1/5/30 min), product import + image downloads, admin alert
  emails, abandoned-lead webhook after 30 min. **Scheduler** (`back/routes/console.php`):
  `domains:verify-pending` (5 min), `support:close-idle` (5 min), `subscriptions:sweep` (1 min),
  `invoices:expire` (hourly), `leads:prune` / `imports:prune` (daily), `admin:daily-summary` (09:00 Cairo).
- **Media**: uploads compressed in the browser (`front/src/lib/media/compress.ts`, compressly), re-encoded to WebP
  on the server (thumb 320 / medium 800 / large 1600). Public disk = `media` volume served by Caddy; **private disk**
  (`storage/app/private`: receipts, import sheets, chat files) = shared `private` volume.
- **Realtime**: Laravel Reverb; events `ShouldBroadcastNow`; a Reverb outage never fails a request (screens reload
  on reconnect). `REVERB_ALLOWED_ORIGINS` takes host names **without port**.

---

## 5. Repository map

```
back/                      Laravel 13 API (PHP 8.3, strict_types everywhere)
  app/Actions/             write operations (SaveProduct, CreateOrder, ChangeOrderStatus, AutoBlock, SaveShippingCompany…)
  app/Billing/             Entitlements, plans catalog, invoices/checkout, PlatformSettings, Themes/ThemeAccess + ThemeCatalog
  app/Pricing/             PriceCalculator, PriceMath, Quote, Shipping
  app/Store/               StoreSite (live store config), StoreSetup (isLive), StoreCatalog, Accounts (customer OTP, reviews)
  app/Themes/Store/        store themes (StoreDesigner, AsasStoreDesign, SufiStoreDesign)
  app/Themes/Landing/      landing themes (LandingThemes, BidayaLandingDesign, ShabeLandingDesign)
  app/Imports/             in-house xlsx/csv reader/writer + product import pipeline
  app/Services/            PublicSite, PublicPageData, Support/* (SupportDesk, SupportFiles), AdminAlerts, Webhooks…
  app/Http/Controllers/Api/V1/{Dashboard,Admin,Public,Auth}/   thin controllers → FormRequest → Action/Service → Resource
  app/Tenancy/             Tenancy, BelongsToTenant, scopes
  config/landing.php       platform settings: limits, fonts, governorates, auto_block, support, platform_admin…
  database/seeders/        ThemeSeeder, PlanSeeder, PaymentMethodSeeder, PlatformPageSeeder, PlatformAdminSeeder, DemoSeeder
  lang/ar/*.php            server-side Arabic (validation, design attributes…); theme starter texts in lang/ar/themes/{store,landing}/{key}.php
  routes/api.php           all API routes (v1); routes/channels.php (Reverb); routes/console.php (schedule)
  tests/Feature/*          Pest feature tests by area (+ Isolation, FullFlowTest); theme tests in Themes/{Store,Landing}
front/                     Next.js 16 (port 3200 locally)
  src/proxy.ts             host routing, A/B split, auth cookie checks (Next 16 "middleware")
  src/app/(auth) (dashboard) (builder) admin platform sites/[host]/{(store),(landing)} api/{auth,bff,public,revalidate,health}
  src/features/<area>/     screens per area (orders, catalog, builder, support, marketing, admin, settings…)
  src/components/          ui/ (button, select, overlay, feedback…), forms/, data/ (table, charts…), layout/, domain/, brand/
  src/themes/              shared/ (design.ts fonts/colors/pick, base.css as-* utilities: both kinds) · store/{shared (logic hooks, context, types), registry.tsx, shell.tsx, asas, sufi} · landing/{live.tsx (picks the page by theme key), bidaya, shabe} · registry.ts (gallery shots), upsell-offer.tsx
  src/lib/                 api client, auth, public (store loading, SEO), store (cart, quote, events), tracking, realtime, env, format…
  src/messages/ar.ts + ar/*.ts   every Arabic string (import { ar } from "@/messages/ar"); theme strings in ar/themes/{store,landing}/{key}.ts
  src/config/              brand.ts (name «مكسب»), navigation.ts
  public/themes/           {store,landing}/{key}/cover.webp + 1..5.webp (gallery pictures of each shipped theme) + store/sufi/demo/*.jpg
deploy/                    Caddyfile, deploy.sh, backup.sh, restore.sh, DEPLOY.md (Arabic guide)
docker-compose.yml         production stack; docker-compose.dev.yml (optional MySQL/Redis for dev)
tools/                     env.sh (portable PHP 8.3 on PATH), start-dev.sh, php/ (portable PHP, git-ignored)
scripts/                   bash smoke scripts (older phases)
```

---

## 6. Domain rules worth knowing before you touch an area

- **Orders**: statuses `new, confirmed, shipped, delivered, cancelled, fake, returned, damaged` with a fixed
  transition table (`OrderStatus::allowedTransitions`), optional note on every change, stock taken at creation and
  returned on cancel/reject/return (`stock_movements`). Order numbers from a per-tenant counter row. Idempotency
  key, honeypot + signed form token, rate limits counted on successful orders, duplicate flag.
- **Customers**: one row per phone per store, created by orders; OTP accounts attach to the same row.
- **Auto block**: same order 3× in 24 h, too many orders per Cairo day, or high return ratio (different numbers
  for landing vs store); lifting a block marks `block_exempt`.
- **Offers**: percentage / fixed / bundle / buy_get / gift, target all/products/categories (incl. sub-categories),
  merchant priority first, then lowest total. **Coupons** incl. free shipping. **Shipping offers** per company.
- **Shipping**: shipping "on" with no active company behaves as off; can't switch on without an active company;
  the first company created turns fees on unless the merchant already chose.
- **Store is live** = store row exists + enabled + plan has `store` + theme publishable (owned, and `buy_themes`
  for paid) + design published once (`StoreSetup::isLive`). Otherwise the store host shows «المتجر لسه بيتجهز».
- **Store designs**: `store_designs` one row per store per theme (`draft`, `published`, `version`); autosave with
  version check (409 `design_changed`); publish copies draft. Switching theme keeps each theme's design.
- **Domains**: pending hosts aren't exclusive; first DNS pass wins (row lock + unique `active_host`); Caddy asks
  `GET /internal/tls/ask` before issuing a certificate.
- **Billing**: one open invoice per kind; invoice + receipt created together at checkout; approval idempotent;
  receipts re-encoded to WebP on the private disk; transfer reference = store code `ST-00025`.
- **Product import**: in-house readers, 8 MB / 20,000 rows, one import at a time per store, failures never stop the
  rest, images downloaded afterwards with SSRF protection.
- **Webhooks / Sheets**: HMAC-signed JSON, SSRF-safe delivery (public IPv4 only, pinned connection).
- **Analytics**: first-party daily counters only (no personal data, no cookies needed).

---

## 7. Themes, designs and the Builder

### Theme catalog
A theme is **code** (renderer + validator) plus a **`themes` row** (store details, price, kind `store|landing`,
images, tags) that the admin edits. `ThemeSeeder` creates rows for code themes and writes store details only the
first time (admin edits are never overwritten). Ownership: free = everyone; paid = `theme_purchases` (bought via a
`theme` invoice or gifted by admin). `ThemeAccess::owns()` / `canPublish()`.
Every key ends with its kind (`{design}_store` / `{design}_landing`): a store theme and a landing theme can share a
design name and are still two themes bought apart. Folders and image paths use the design name under the kind.
The kind is read-only (written by `ThemeSeeder` from the code, refused by the admin API) and shown next to the name
wherever a theme is named alone (`ar.common.themeName` → «صوفي · متجر»).

| Key | Kind | Price | Notes |
|---|---|---|---|
| `asas_store` «أساس» | store | free | default store theme; sections: banner, products, features, testimonials (≤20) |
| `sufi_store` «صوفي» | store | paid (990 placeholder) | light luxury theme with dark mode; 16 home sections (≤30); see below |
| `bidaya_landing` «بداية» | landing | free | one-product landing page; sections + exactly one order form (≤12) |
| `shabe_landing` «شابع» | landing | paid (100) | food landing page (meals, boxes, trays); 14 section types + one order form (≤20); see below |
| `shabe_store` «شابع» | store | paid (990 placeholder), hidden until done | food store: 15 home sections (≤30) incl. «مواعيد العمل»; see below |

### «شابع» (paid food landing theme)
- Back end `App\Themes\Landing\ShabeLandingDesign` (wired in `LandingThemes`); settings = «بداية»'s + `colors.dark` (dark sections),
  `display_font` (Lalezar titles), `header.countdown_ends_at|phone|button_label`. Sections: hero (highlighted word,
  2 stickers, discount badge, rating, 2 buttons, trust items), marquee, menu (dishes with weights + extras), why,
  steps, bundles, gallery, video, compare, testimonials (photos, place, overall score), urgency (countdown + real
  product stock), order_form (+ side card points/image), guarantee, faq.
- Bundles: cards tied to the product's **offers** (`offer_id`, null = one piece); empty list = one card per running
  offer automatically. Card prices are a display estimate with the same rules as `PriceMath` (`dealOf`); the order
  form still shows the server's quote. «اختار ده» sends `shabe:choose-offer` → the form picks that offer.
- Front `themes/landing/shabe/` reuses «بداية»'s page context (`PageProvider`), order hook, code box and summary; the
  landing Builder edits both themes (`features/landings/shabe-forms.tsx`). Live, preview, done page pick by theme key.

### Store theme architecture
- Back end, **one contract per store theme**: `App\Themes\Store\StoreThemeDesign` (abstract) does the validation
  and clean-up once; a theme only declares `KEY`, `SECTION_TYPES`, `MAX_SECTIONS`, `SETTINGS_GROUPS`, `defaults()`,
  `settingsRules()` / `cleanSettings()` (usually the base settings + its own) and may extend a section type
  («صوفي»'s reviews add `layout`). `StoreSections` is the **section library**: rules and storage of every home
  section type, written once, offered by any theme. `StoreThemes` is the only place that picks by key (unknown →
  «أساس»); `StoreDesigner` asks it. The design payload sends the theme's `section_types`, `max_sections` and
  `settings_groups`, so the Builder offers exactly what the server accepts. `StoreThemesContractTest` checks every
  registered theme (starter design validates unchanged, every section type known, a store row exists).
  `StoreDesigner::data()` builds what sections show by section type (`products["{id}:{tab}"]`, `category_tiles`,
  `featured`, `links`, `media`).
- Front, **logic apart from look**: `themes/store/shared/` holds what every store theme does, with no look of its own:
  `use-product-buy` (options, price, stock, add to cart / buy now + pixels), `use-checkout` (form rules, saved
  addresses, quote, code, shipping company, lead, placing the order), `use-account` (sign in with a code, signed-in
  guard, sign out, address and profile forms), `use-listing` (search/sort/filters in the link), `use-track`,
  `use-review-form`; plus `context` (mode, `StoreLink`, `useHydrated`), `shop` (`useShop`) and `types` (base
  `StoreSettings`, `DesignData`, `ProductCard`). Fonts, colors and `pick` are in `themes/shared/design.ts` and the
  `as-*` utilities in `themes/shared/base.css` (shared with landing themes on purpose: one file, no clashes).
  A theme's pages are look only, drawn on these hooks.
- `themes/store/registry.tsx` is the **only place that picks by theme key**: each store theme gives its `Frame`
  (header/footer around live pages), `Home` (live home sections), `Canvas` (whole home for the Builder, preview and
  showcase) and `pages` (Product, Listing, Cart, Checkout, OrderDone, StaticPage, NotFound, Track, SignIn, Account,
  MyOrder). Unknown keys get «أساس». `StoreShell` (`themes/store/shell.tsx`) is the live layout for every theme
  (visit count, cart sync, pixels) and draws the theme's `Frame`; every store route takes its page from the registry.
- «أساس» has its own inner pages (`themes/store/asas/pages/`, CSS variables `--as-*` on `.as-root`). «صوفي» draws its
  own frame and home and, for now, uses «أساس»'s inner pages in its colors (and dark mode: `SufiRoot` feeds the
  current scheme's colors into `AsasRoot`). New store themes build their own inner pages (owner decision 2026-11-17).
- Modes: `live` (real store), `builder` (sections selectable, links inert, no motion), `preview` (links inert, motion
  on — used by the design preview and the theme showcase).
- Layout is **container-query based** (`@3xl`, `@5xl`), so the Builder's device frames preview exactly.

### «صوفي» specifics
- Sections: `hero` (full-height slider, can merge with a transparent header — pure CSS via `:has(.sf-hero[data-merge])`
  and a negative margin of the computed header height), `marquee`, `categories` (tiles with images, grid or slider),
  `product_tabs` (tabs of latest/offers/category/hand-picked), `banners` (1–3), `countdown` (hide or «العرض انتهى»
  when done; times stored UTC), `featured_product` (options + add to cart from the home), `products`, `video`
  (YouTube/Vimeo **link only**, click to play), `brands`, `story`, `features`, `testimonials`, `gallery`
  (big first tile; last tile widens to close its row), `faq`, `location` (branches + Google Maps embed from the
  merchant's maps link; short `maps.app.goo.gl` links fall back to the address).
- Floating WhatsApp/call buttons and an offers side-tab sit under the header's z-index (so the phone menu covers them).
- Dark mode: visitor's choice stored in `localStorage` (`sf_scheme`) via `useSyncExternalStore` (no hydration
  mismatch); the first paint uses the merchant's default.
- Showcase store data: `front/src/themes/store/sufi/demo.ts` + `public/themes/store/sufi/demo/*.jpg` (Unsplash, free licence).
  Theme pictures (cover + 5, store and landing themes) + which themes have a showcase: `front/src/themes/registry.ts`;
  the admin's own uploads show first. Shipped texts: `ThemeSeeder::THEMES`, written again with `php artisan themes:copy [key]`.
- Decision: paid themes change the **home, header and footer**; inner pages stay shared for now (future themes may
  restyle inner pages — the owner saw a product-page design for Sufi but it is not built; it also needed size
  guides, delivery estimates and review photos which don't exist yet).

### «شابع · متجر» (food store, part 1 of 3: home, header, footer)
- Back `ShabeStoreDesign`: base settings + `colors.dark`, `display_font` (Lalezar titles), `button` shape, header
  `layout start|center`, `countdown_ends_at`, `hotline` (5-digit hotlines allowed), `button_label/button_link`,
  `categories_menu`; footer `dark`, `payments`; general `floating_call`, `call_phone`, `animations`. New library
  types in `StoreSections`: `food_hero`, `why`, `steps`, `bundles` (cards tied to offers; `StoreDesigner::data()`
  sends `bundles[section][card] = {offer, product|null, href}`, null when the offer can't be offered), `hours`
  (7 days Saturday first, open/from/to, open and closed messages).
- Front `themes/store/shabe/` (prefix `ss-`, never the landing's `sh-`), own header/footer/card; inner pages are
  «أساس»'s until parts 2–3 (product page + card settings, then category pages + cart). Shared logic added:
  `use-quick-add` (card add-to-cart, «صوفي» uses it too), `use-hours` (`isOpenAt`, `cairoNow`: Cairo time, hours
  past midnight count for the day they started), `use-countdown`, `contact` (`whatsappLink`, `telLink`).
- Builder: `features/builder/themes/shabe.tsx` + `shabe-store-forms.tsx`. The theme row is unlisted
  (`'listed' => false` in `ThemeSeeder`) until all parts are built; the admin lists it.

### Adding a new store theme (checklist)
1. Back: a class extending `StoreThemeDesign` in `app/Themes/Store/` (its section types from `StoreSections`; a new
   type goes into `StoreSections` once, plus `StoreDesigner::data()` if it shows store data), added to
   `StoreThemes::THEMES`; a `ThemeSeeder` row (kind store); lang strings in `lang/ar/themes/store/{design}.php`.
2. Front storefront: `themes/store/{design}/` (types, root, chrome, sections, frame, and its own inner pages built
   on the hooks in `themes/store/shared/`), one entry in `themes/store/registry.tsx`.
3. Front Builder: `features/builder/themes/{design}.tsx` (a form per settings group it has, its section form, new
   sections; library types use `LibrarySectionForm`), one entry in `features/builder/themes/index.ts`. A test keeps
   both registries listing the same keys.
4. Tests: back feature tests (switch after purchase, save every section, validation) + the contract test passes;
   front render + Builder tests.
5. Cover + 5 pictures into `public/themes/store/{design}/` (1600×1000 WebP), a showcase `demo.ts` if it should
   have «معاينة الثيم», shots in `themes/registry.ts`.

### Builder
`front/src/features/builder/`: `builder.tsx` (store), `kit.tsx` (shared editing state: undo/redo, autosave 700 ms,
version conflicts, rail, inspector, device frames), `section-forms.tsx` (asas + shared forms), `sufi-forms.tsx`,
`theme-forms.tsx`, `section-gallery.tsx`, `theme-page.tsx`, `theme-detail.tsx`, `theme-demo.tsx`.
Landing Builder lives in `features/landings/`.

---

## 8. Front-end conventions

- **Colors only from tokens** (`bg-surface`, `text-ink-2`, `bg-brand-soft`…) in `front/src/app/globals.css`
  (palette «نعناع», temporary until the owner's brand). Primary button: dark green with white text; one primary per
  area; yellow `accent` for attention only.
- **Numbers** in Latin digits, tabular; money via `formatMoney`, dates in Cairo time via `formatDateTime`.
- **RTL logical classes only**; number/phone/money inputs are `dir="ltr"`.
- **Four states per screen**: Skeleton, EmptyState, ErrorState (+ retry), toast.
- **Forms**: react-hook-form + zod; server 422 errors land on the field. Never native `<select>` / `<input type=date>`
  in the dashboard — use `Select` / `MultiSelect` / `DatePicker` (the storefront checkout may use the native select).
- **Tables**: `DataTable`, filters/search/page in the URL (`useUrlState`).
- **Data**: TanStack Query (`lib/query.tsx`), API via `lib/api/client.ts` (`api`, `apiPage`, `apiUpload`).
- **Server Components by default**; `"use client"` only where needed. Don't export non-components from client
  modules that server pages import (it broke prerendering once).
- **React 19 lint rules** are strict: no `setState` directly inside effects (use `useSyncExternalStore` for
  browser state/time), no refs during render.
- **New UI component → add it to `/dashboard/components` first** with all its states.
- Every clickable thing has `cursor: pointer`; thin scrollbars; tabs without visible scrollbars.

## 9. Back-end conventions

- `declare(strict_types=1)`; thin controllers → FormRequest → Action/Service → Resource; backed enums; explicit
  `$fillable`; `ApiException(status, code, message, errors)`; `RespondsWithJson` (`ok`, `created`, `paginated`,
  `noContent`).
- Validation messages/attributes in Arabic (`lang/ar`). Route-bound tenant models 404 across tenants.
- Pint (`composer lint`) must pass; Pest (`composer test`, 800+ tests).

---

## 10. Local development (Windows dev box)

- **Shells**: Git Bash (Bash tool) and PowerShell. `source tools/env.sh` puts portable PHP 8.3 first.
- **DB**: XAMPP MariaDB 10.4, root without password, databases `landing` (dev) and `landing_test` (tests).
  No Redis locally (database cache/queue); no Docker locally.
- **Run everything**: `bash tools/start-dev.sh` → Laravel `:8010`, queue worker, scheduler, Reverb `:8080`, Next
  `:3200`. Local hosts: `app.localhost:3200` (dashboard), `localhost:3200` (platform), `{store}.localhost:3200`.
  Local custom domains: `*.localtest.me` (resolves to 127.0.0.1).
- **Accounts** (after `php artisan platform:demo`, refuses production): merchant `demo@example.com`, super admin
  `admin@example.com`, password `demo-pass-123`. The owner uses these too — don't change their data.
- **Commands**: back `composer test`, `composer lint`; front `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
  `php artisan cache:clear` resets the register rate limit (5/hour/IP) before scripted sign-ups.
- **Browser checks**: Playwright via `playwright-core@1.64.1` installed in a scratch folder (Chromium build 1248 is
  in `%LOCALAPPDATA%\ms-playwright`); launch with `--host-resolver-rules=MAP *.localhost 127.0.0.1`. API calls from
  Node must target `127.0.0.1:3200` with `Host: app.localhost:3200`, `Origin: http://app.localhost:3200` and the
  cookie (Node DNS doesn't resolve `*.localhost`; the BFF refuses writes without Origin).
- **Known gotchas**:
  - Shell text processing halves backslashes: write PHP (namespaces, regex) with the Write/Edit tools or a Python
    script file (open with `newline="\n"`); very long heredocs fail with "unexpected EOF".
  - `next start` keeps old processes alive on port 3200 — kill orphan `node … next start` before restarting; delete
    `.next` if the build says ENOTEMPTY. Files added to `public/` after a build are not served until the next build.
  - React 19 suspends concurrent renders on `<link rel=stylesheet precedence>` (theme fonts); jsdom never loads it, so
    Builder tests prime the theme with one synchronous render first (see `sufi-builder.test.tsx`).
  - `src/features/support/support.test.tsx` "starts a conversation…" is flaky under full-suite load (passes alone).
  - `php artisan tinker <file>` sometimes doesn't exit after running; check the result and move on.
  - Reverb locally: `REVERB_ALLOWED_ORIGINS=*` in `back/.env` (production uses the app host).
  - A leftover `front-v2/` folder (locked `node_modules`/`.next`) may exist and is git-ignored; safe to delete.

---

## 11. Production

- **Server**: the owner's Contabo "Cloud VPS 4" (EU), IP `13.140.220.40`, user `root`, project in `~/landing`.
  Domain **mksab.store** (since 2026-11-15; sslip.io dropped): `PLATFORM_DOMAIN=mksab.store`, `APP_HOST=app.mksab.store`,
  stores at `{name}.mksab.store`. DNS + mailbox `support@mksab.store` at Hostinger.
- **Deploy**: `cd ~/landing && git pull origin main && ./deploy/deploy.sh` (builds images, migrates, runs all
  seeders + `PlatformAdminSeeder`, health checks). Full guide in `deploy/DEPLOY.md` (Arabic).
- **Services**: caddy, front, back-web (nginx), back-app (php-fpm, Debian image — Alpine's iconv can't read
  Windows-1256 CSVs), queue, scheduler, reverb, mysql, redis. Volumes: `mysql_data`, `redis_data`, `media`,
  `private`, `caddy_data`, `caddy_config`.
- **`.env`** (root): domains, `SERVER_IP`, secrets (`APP_KEY`, `INTERNAL_API_KEY`, `REVALIDATE_SECRET`, `REVERB_*`),
  DB passwords, optional `MAIL_*` (log until SMTP is set), `PLATFORM_ADMIN_NAME/EMAIL/PASSWORD/PHONE` (the owner's
  super admin, created once, never overwritten — he must change the starter password after first sign-in).
- **Backups**: `deploy/backup.sh` (DB + media + private, 14 days) via cron; `deploy/restore.sh`.
- The first real deploy happened on 2026-11-14 and worked (the owner created a store and landing page). The first
  issue he hit was a store 404 because the store was not switched on → fixed with the «بيتجهز» page + checklist.

---

## 12. Roadmap — agreed future work (owner's priority order)

1. **Notifications system on WhatsApp — IN PROGRESS** (plan and channel rules in DECISIONS.md 2026-11-15).
   - Done (part 1): `App\Messaging\WhatsApp` (gateway, templates, messenger, webhook), `outbound_messages`, customer
     codes on WhatsApp, merchant/admin «نسيت كلمة السر», admin «رسائل واتساب». Meta account: portfolio «Mksab», number
     +20 10 91152636 (ids in `.env`), no business verification (owner has no papers). **No SMS** (dropped).
   - Done (part 2): `App\Notifications` (NotificationCenter, StoreNotices, Notice), the bell in both shells (live on
     `user.{id}`), store-owner + admin notifications with a WhatsApp/email choice and email fallback, plan reminders,
     admin alert channel settings (DECISIONS.md 2026-11-16). Email is complete: only `MAIL_*` is missing.
   - Done (part 3): order messages to customers (received / shipped / cancelled / delivered) by email or WhatsApp
     (checkout + landing opt-in, unchecked by default; customer's choice in their account), `/t/{token}` short link,
     «رسايل العميل» on the order page (DECISIONS.md 2026-11-16).
   - Waiting on Meta: template review (none approved yet on 2026-11-16). On the server: push the 3 link templates
     from /admin/messages, set the webhook, publish the app, fill `MAIL_*`. Suggested for later: order confirmation by
     WhatsApp buttons.
2. **Paid plans / online payment**: Paymob gateway (`PaymentGateway` contract, `ManualGateway` today) when the owner
   has an account; later auto-renew with saved cards, then customer online payment with the merchant's own account.
3. **More paid themes** for stores and landing pages, from the owner's designs. Paid landing themes are bought like
   store themes (checkout `?theme=`). Future themes may restyle inner store pages.
4. Suggested and discussed, **not yet requested**: staff accounts and permissions, shipping carrier integration
   (Bosta first; merchant connects own account), Conversions API, AI copywriter, removing «صنع بواسطة مكسب» on Max,
   a showcase store for «أساس», dashboard dark mode,
   `composer update` for pre-existing laravel/framework & symfony security advisories (do it as its own step),
   fixing the flaky support test properly, a sample EasyOrders export to tune the import mapper.

---

## 13. Git state (2026-11-14)

- Branch **`v4`** (current work). `main` on GitHub (`origin`, private repo `M-Rashad-dev/landing`) was fast-forwarded
  to `b385c66` (cut-over) and deployed.
- Everything up to the brand logo commit is pushed to `v4` and `main`. The server picks up «صوفي» and the logo on
  the owner's next `./deploy/deploy.sh` (ThemeSeeder adds the «صوفي» row).
