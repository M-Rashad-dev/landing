# PLAN — Product specifications (platform) + «تيكنو» electronics store theme

> **You are a new Claude session continuing this project.** Read `docs/HANDOFF.md` §2–§4 (owner's rules,
> stage checklist, machine traps) and `CLAUDE.md` first, then this whole file. Then wait for the owner's
> «ابدأ». Talk to the owner in **Egyptian Arabic only** (never English sentences). Code, comments and docs
> in English; every Arabic UI string in `front/src/messages/ar/*` / `back/lang/ar/*`.

The owner approved **exact designs**. They are not inspiration: build what they show.

| File | What |
|---|---|
| `docs/plans/tekno/tekno-1-home.png` | the approved store **home page**, full length (desktop 1440) |
| `docs/plans/tekno/tekno-2-product-page.png` | the approved **product page**, **mega menu**, **phone home** |
| `docs/plans/tekno/mockup/home.html` | the HTML the home image was rendered from — open it in a browser; copy colors, sizes, spacing, radii, copy texts from its CSS and markup |
| `docs/plans/tekno/mockup/product.html` | the same for the product page / mega menu / phone |
| `docs/plans/tekno/mockup/img/*.jpg` | placeholder photos of the mockup only (some show real brands: **never ship them**) |

Every red/orange pill «جديد…» in the images marks something new to build; the pills themselves are
annotations, **not UI**. Brand names in the images (NOVA, ZENTRO…) are fake samples. Everything else
(layout, order, colors, card anatomy, copy) must match. When the platform truly cannot do something the
image shows, this plan says what to do instead (§7 «Deviations») — don't invent other deviations; ask the
owner.

Owner's decisions (2026-11-28):
1. Build **product specifications in the platform first** (general, for every store type), then the theme.
2. Price: **990 EGP** (every new store theme is 990 by default — never ask again).
3. Split the work into stages freely; what matters: **every stage ships 100% right** (tested, reviewed).

---

## 0. Order of work and stop points

| Stage | What | Stop for review |
|---|---|---|
| **S1** | Product specifications «المواصفات»: spec groups, product card in the product form, bulk apply + fill grid, storefront table in every theme, import/export, copilot, product `video_url` | yes |
| **S2** | Spec filters on category pages (all themes) + product comparison logic + browser wishlist «المفضلة» + review's product name | yes |
| **S3** | Product questions «أسئلة العملاء» (visitor asks, merchant answers, shown on the product page) | yes |
| **T1** | «تيكنو» frame: theme class, header + mega menu + footer + bottom nav (phone), settings groups, product card, home sections part 1 (tech_hero, features, categories, deal_of_day, product_tabs, products, brands, banners, services, testimonials, faq, cta, ai) | yes |
| **T2** | «تيكنو» shopping pages: product page, category/search pages with spec filters, compare bar + compare page, wishlist page, cart, checkout, done | yes |
| **T3** | «تيكنو» home sections part 2: device_finder, compare_table, buy_together, installments, trade_in; installments settings group | yes |
| **T4** | Release: showcase demo (real unbranded photos), cover + 5 gallery pictures, AI designer guide, listing, docs | yes, then the owner reviews locally before any deploy |

Hidden from the theme store (`'listed' => false` in `ThemeSeeder`) until T4; T4 lists it with a migration
(see `2026_12_18_100003_list_rawaq_store_theme.php`). **Never deploy** — the owner deploys himself or tells you.

Each stage ends with the HANDOFF stage checklist: tests green (back `php artisan test --parallel`, `composer
lint`; front `pnpm lint && pnpm typecheck && pnpm test && pnpm build`), a browser check on **your own
throwaway store** (never the owner's demo store), DECISIONS.md entry, a PROGRESS LOG entry at the end of
this file, commit (explicit paths) + push `v4` and `v4:main`, a short Arabic report with screenshots, and
«مستني مراجعتك قبل ما أبدأ المرحلة …».

---

## 1. S1 — Product specifications «المواصفات» (platform feature)

### 1.1 The idea (owner's words, final)
- General for any store (electronics, clothes, perfumes…). A merchant who never uses it sees nothing new
  except one collapsed card «المواصفات (اختياري)» in the product form.
- A **spec group** = one table: a **name** + **rows**; a row is a **label only**. No templates with
  sub-groups (owner: too hard). Examples: «لابتوب» (المعالج، الرامات، التخزين، الشاشة…), «الضمان»
  (المدة، النوع)، «خامة الملابس».
- **All values are plain text.** No number+unit, no yes/no type. The merchant types «16GB», «16 جيجا»,
  «نعم», «غير متاح»…
- In a product: «أضف مجموعة» (several groups per product). The group's rows are **copied into the
  product**; the merchant fills the values. Afterwards he may **delete / add / rename / reorder rows for
  this product only** (the group stays as it is). Or «جدول جديد» = a table for this product only, with
  «احفظه كمجموعة» to reuse it.
- Editing a group later: button «ضيف التعديل للمنتجات اللي بتستخدمها» = add the group's new rows to the
  products that use it (append missing labels, never touch existing values, never delete).
- **No automatic link to categories.** Instead: in a group, «أضف المجموعة لمنتجات» (pick many products,
  search + category filter + check boxes) and a tab «املأ القيم»: an Excel-like grid (rows = products using
  the group, columns = the group's labels), Tab/Enter navigation, save once.
- Two optional flags per **row** (set in the group, copied to products, editable per product):
  - «يظهر في كارت المنتج» — at most 4 per product; shown as small chips on product cards (themes that show
    them: «تيكنو» now; others may later).
  - «فلتر في صفحة القسم» — used in S2. Values are filtered **as typed**; the screen warns that «16GB» and
  «16 جيجا» become two choices.
- Storefront: every store theme's product page shows «المواصفات» (each group with its name as heading, rows
  as a two-column table) **only when the product has specs**.
- Import/export Excel, and the copilot can fill values from descriptions (with approval).

### 1.2 Data (back end)
Migrations (next free dates after `2026_12_18_100003`):

```
spec_groups            id, tenant_id, name (string 60), position (uint), timestamps, unique(tenant_id, name)
spec_group_rows        id, tenant_id, spec_group_id (fk cascade), label (string 60), position,
                       in_card (bool, default false), filterable (bool, default false)
product_spec_tables    id, tenant_id, product_id (fk cascade), spec_group_id (nullable fk, null on delete),
                       name (string 60), position
product_spec_rows      id, tenant_id, product_spec_table_id (fk cascade), label (string 60),
                       value (string 200, nullable), position, in_card (bool), filterable (bool),
                       index(tenant_id, label) for filters
```
- All tenant tables: `BelongsToTenant`. Product deletes cascade. Deleting a group keeps the products'
  copies (their `spec_group_id` becomes null; they stop receiving «ضيف التعديل»).
- Limits (config `landing.limits`): groups ≤ 100 per store, rows ≤ 40 per group / per product table,
  tables ≤ 6 per product, `in_card` ≤ 4 per product (validated on save: the extra ones are refused with an
  error, never silently dropped).
- Copy semantics: «أضف مجموعة» copies rows (label, position, flags) into a new `product_spec_tables` row
  with `spec_group_id` and `name` = group name. «ضيف التعديل»: for every product table linked to the group,
  append each group row whose label isn't in the table (keep positions after the existing ones).

### 1.3 API (dashboard; permissions: reuse catalog/products page actions; map every route in
`config/permissions.php` «routes»)
```
GET    /dashboard/spec-groups                      list (name, rows count, products count)
POST   /dashboard/spec-groups                      {name, rows:[{label,in_card,filterable}]}
GET    /dashboard/spec-groups/{id}
PUT    /dashboard/spec-groups/{id}                 same body (rows replaced in order)
DELETE /dashboard/spec-groups/{id}
POST   /dashboard/spec-groups/{id}/apply           {product_ids:[…≤500]}  adds the group to products that don't have it
POST   /dashboard/spec-groups/{id}/push            «ضيف التعديل للمنتجات اللي بتستخدمها» → {updated: n}
GET    /dashboard/spec-groups/{id}/grid            products using it + their values by label (paged 50)
PUT    /dashboard/spec-groups/{id}/grid            {rows:[{product_id, values:{label: value|null}}]} (≤200 per call)
GET    /dashboard/products/{id}  → adds `specs: [{id, spec_group_id, name, rows:[{label,value,in_card,filterable}]}]`
PUT    /dashboard/products/{id}  → accepts `specs` (whole list replaced, validated) in the existing product request
```
FormRequests with `TenantExists` on `product_ids` / `spec_group_id`; cross-tenant ids → 404/422 like the
rest. Feature tests per endpoint: success, validation, 401, tenant isolation, limits, «push» not touching
values, delete group keeps copies.

Storefront data: the public product payload gets `specs` (tables with rows, values non-empty only, ordered);
product **cards** (`StoreCatalog::card`) get `spec_chips: string[]` (values of `in_card` rows, ≤4, in row
order). Eager-load in one query per page (no N+1; add a test counting queries for a 24-card page if a
pattern exists, else keep it to one `whereIn` load).

Product `video_url` (nullable string 300, YouTube/Vimeo https, `SafeUrl` + the same host regex as
`StoreSections::VIDEO_HOSTS`): new column on `products`, a field «فيديو المنتج (اختياري)» in the product
form, sent in the public product payload. («تيكنو» shows «فيديو المنتج ▶» on the gallery.)

### 1.4 Dashboard UI (front)
- Navigation: «المنتجات» group → new item «مجموعات المواصفات» (`/dashboard/catalog/spec-groups`), in
  `src/config/navigation.ts` + `src/lib/auth/permissions.ts` PAGES + `components.test.tsx` hrefs.
- List page: cards/table (name, rows, products using it), «مجموعة جديدة», empty state that explains with
  three examples (لابتوب / ملابس / عطور).
- Group page: tabs «الصفوف» | «املأ القيم».
  - «الصفوف»: name; rows list (label input, two switches «يظهر في كارت المنتج» «فلتر في صفحة القسم»,
    up/down, delete, «ضيف صف»); buttons «أضف المجموعة لمنتجات» (dialog: search, category filter, check
    boxes, «أضف») and «ضيف التعديل للمنتجات اللي بتستخدمها» (confirm, then toast «اتحدّث N منتج»).
  - «املأ القيم»: grid (sticky first column = product name + thumb; one column per label; inputs; Tab moves
    right, Enter moves down; dirty cells highlighted; «احفظ» saves changed rows only; unsaved-changes guard).
- Product form: card «المواصفات (اختياري)», collapsed by default when empty. Inside: each table as a block
  (name editable, rows: label + value inputs + the two flags as small toggles, up/down/delete, «ضيف صف»),
  «أضف مجموعة» (select from groups), «جدول جديد», per table «احفظه كمجموعة» (creates a group from it).
  Errors under fields (react-hook-form + zod), 4 states, RTL.

### 1.5 Import / export
`StartImport` / product import: columns named `«{group}: {label}»` fill that table/row (creating the table
from the group when missing, or a product-only table named `{group}` when no group exists). Export writes the
same columns. Tests for both directions.

### 1.6 Copilot (mandatory for every feature — docs/PROJECT.md «AI»)
- Resource `SpecGroupsResource` (read/create/update; fields name, rows).
- Product resource: `specs` readable (summary «لابتوب: 12 صف») and writable through the product request.
- Action `ProductsFillSpecs`: «املأ مواصفات المنتجات دي من الوصف» → for chosen products with a table, the
  content model proposes values for empty rows from name + description; preview before → after; applied
  on «نفّذ»; undo within 24 h (same pipeline as `ProductsWriteContent`). Never invents rows; leaves a value
  empty when the text doesn't say it.
- Permissions map entries in `config/permissions.php` «copilot».

### 1.7 Storefront in every theme
Add a shared component `themes/store/shared/specs.tsx` (plain two-column table per group, heading = group
name, alternate row background from the theme's CSS variables, RTL). Each theme's product page renders it
under the description (asas, sufi, shabe, rawaq; tekno draws its own in T2). Only when `specs.length > 0`.
Front tests per theme: shown with specs, absent without.

---

## 2. S2 — Spec filters, comparison, wishlist, review product name

### 2.1 Filters (all themes' category / search pages)
- `StoreCatalog::search` accepts `spec[label]=value` (multiple values per label = OR, labels = AND). Only
  `filterable` rows count. Values compared exactly (trimmed).
- Facets: for the current category (with descendants) / search, the distinct values per filterable label
  with counts (top 30 labels × 50 values; cached per tenant+category 10 min, busted on product save).
- Shared filter UI in the listing filters panel of each theme (checkbox lists per label, «امسح»).

### 2.2 Comparison (logic used by «تيكنو»)
- Browser-only list `as_compare_v1` in localStorage (≤4 product ids) with a small hook `useCompare()` in
  `src/lib/store/compare.ts` (add/remove/clear, event to sync tabs).
- Public endpoint `GET public/store/compare?host&ids=1,2,3` → the products' cards + their spec rows merged by
  label (rows in the order of the first product, then new labels), plus price/compare_at/available.
- Store route `/compare` (reserved slug like `products`, `cart`): rendered by the theme registry's
  `pages.Compare` (fallback shared simple table for themes without their own).

### 2.3 Wishlist «المفضلة» (browser only, no account needed)
`as_wishlist_v1` in localStorage (≤100 ids), `useWishlist()`, store route `/wishlist` (`pages.Wishlist`,
shared fallback = product grid), public endpoint reusing the cards endpoint for ids. No server table.

### 2.4 Reviews
`ProductReviews::forHome` adds `product: {name, slug}` to each review (front types updated). «تيكنو» shows
«اشترى: {name}».

---

## 3. S3 — Product questions «أسئلة العملاء»

- Table `product_questions`: id, tenant_id, product_id (fk cascade), name (string 60), phone (nullable, hidden
  from the storefront and the copilot), question (string 500), answer (text nullable), answered_at,
  is_published (bool, default false), timestamps.
- Public `POST public/store/products/{slug}/questions` {name, phone?, question} (form token + honeypot +
  rate limit like leads: 5/hour per visitor) → 202. Public product payload: published answered ones
  (latest 20) `{name, question, answer, answered_at}`.
- Dashboard «أسئلة العملاء» page under «التقييمات» group: list (unanswered first), answer + publish, hide,
  delete. Notification to the store owner on a new question (NotificationEvent + StoreNotices + bell icon).
- Copilot: resource (read questions, write answers via the dashboard request; phone hidden).
- Product page (all themes get a simple block «أسئلة العملاء» + «اسأل سؤال» form; «تيكنو» its own tab).
- Tests: success, validation, 401, isolation, rate limit, unpublished hidden.

---

## 4. «تيكنو» — the theme (T1–T4)

Key `tekno_store`, name «تيكنو», price 990, tags `['electronics']`, sort after «رواق». Back class
`App\Themes\Store\TeknoStoreDesign` (extends `StoreThemeDesign`, like `RawaqStoreDesign`), registered in
`StoreThemes`; front folder `src/themes/store/tekno/` (own CSS prefix `tk-`), Builder
`src/features/builder/tekno-forms.tsx` + `features/builder/themes/tekno.tsx`, messages
`messages/ar/themes/store/tekno.ts` (visitor) and `design.tekno` (Builder), lang
`back/lang/ar/themes/store/tekno.php`. Follow «رواق» file by file — it is the newest and cleanest example
(see commits `a8bb9896`, `e0d6fe6b`, `e3697e28`, `a5602272` and DECISIONS «رواق»). Every registry «رواق»
touched, «تيكنو» touches too (§8 checklist).

### 4.1 Look (copy from the mockup CSS)
- Colors (merchant-editable, these are defaults): `primary #2563eb` (buttons), `secondary #22d3ee`
  (cyan accents, search button, timer digits), `background #f2f4f8`, `text #0b1220`, plus theme keys
  `colors.dark #0f1a2e` (header, hero, deal, trade-in), `colors.deal #a3e635` (lime: installments,
  savings, «عروض اليوم»).
- Fonts: body Cairo (merchant font setting), titles **Readex Pro** (`display_font` switch like «رواق»).
- Radius 12–16 px cards, 22–24 px big blocks, buttons 12 px (merchant `button` setting: rounded/pill/square).
- Container 1280 + 32 px padding (mockup `.wrap`). Section rhythm 46 px. Container queries like «رواق»
  (`@3xl` = desktop, phone layout below), so the Builder's phone frame shows the phone layout.

### 4.2 Frame (T1) — see top of `tekno-1-home.png` and the phone in `tekno-2-product-page.png`
1. **Strip** (dark `#0b1220`): announcement start side («شحن مجاني فوق 2000 ج · ضمان الوكيل على كل
   الأجهزة»), end side «تابع طلبك · الخط الساخن 19999» (track link + `header.hotline`).
2. **Header** (dark navy): logo (or store name with a cyan dot like the mockup), **search with a category
   select** («كل الأقسام ▾», submits `/products?q=…&category=slug`), placeholder «ابحث باسم الجهاز أو
   الموديل… مثلًا: لابتوب i7 16GB», cyan «بحث» button; icons with labels: «قارن» (count badge from
   `useCompare`), «المفضلة» (wishlist), «حسابي», «السلة» (count badge).
3. **Nav bar** (`#13213a`): blue «☰ كل الأقسام» button that opens the **mega menu**; top categories; a
   last item in lime «⚡ عروض اليوم» (link = offers).
4. **Mega menu** (`tekno-2-product-page.png`, top right): side list of top categories (hover/active =
   blue start border), up to 2 link columns per category («حسب الاستخدام», «حسب السعر»…), a promo card
   (image + title + small text + link). Settings group `mega_menu` (§4.5). Without settings: the side list +
   the category's sub-categories as one column, no promo.
5. **Footer** (dark): 5 columns exactly as the mockup (about + logo, «الأقسام», «المساعدة» (تابع طلبك /
   الضمان والصيانة / الاستبدال / التقسيط → store pages links set in footer settings), «تواصل معانا», «طرق
   الدفع» chips from the store's real payment methods + «تقسيط» when installments are on), bottom line «©
   2026 {store} · صنع بواسطة مكسب».
6. **Phone**: compact header (☰, logo, cart), search under it, and a **bottom nav** «الرئيسية / الأقسام /
   قارن / السلة / حسابي» (fixed; the product page's sticky bar sits above it).

### 4.3 Product card (T1) — mockup «اختار جهازك» grid
Anatomy top → bottom: photo (cover, `#f8fafc` plate) with **discount pill** (red, top start) and **«قارن»
checkbox chip** (top end; checked = blue square); optional condition/first chip shown as dark label bottom
start only if the merchant flags a row «يظهر في كارت المنتج» named in setting `card.badge_label` (default
«الحالة») — otherwise all card chips go in the chips line; name (2 lines); **spec chips** (`spec_chips`, gray);
stars + average + count; price + old price; **installment line** green «أو X ج/شهر بدون فوايد» (when
installments are on and price ≥ `installments.min_price`) or a **stock line** amber «فاضل N بس» when
stock ≤ `card.low_stock` (installment line wins when both); full-width blue «أضف للسلة» (or «اختار» when
options are needed, like other themes).
Settings group `product_card`: `show_specs`, `show_compare`, `show_rating`, `show_installment`,
`low_stock` (0–20), `badge_label` (text ≤30), `radius` (0–24).

### 4.4 Home sections (all in `StoreSections` as shared types unless noted; props names below are final)
Reused library types (same props as today): `features` (the 5-item trust strip under the hero; «تيكنو» draws
it as the white strip with icon tiles), `categories` (circle images on white cards, 8 per row),
`product_tabs` (dark active tab pill), `products`, `brands` (text or logo tiles), `banners`, `video`,
`testimonials`, `faq`, `cta`, `countdown`, `ai`.

New types (T1 unless marked T3):

1. **`tech_hero`** — big slider + 2 side tiles.
   - `slides` 1–4: `{kicker ≤40, title req ≤90, highlight ≤30 (cyan word), subtitle ≤200, media_id req,
     chips string[] ≤4 (≤20 each), product_id nullable (price + old price + installment line taken from the
     real product; never typed prices), button_label req ≤30, link, second_label ≤30, second_link}`.
   - `tiles` 0–2: `{media_id req, kicker ≤30, title req ≤50, text ≤40, color #hex nullable, link}`.
   - Auto-play every 6 s (paused on hover; no autoplay in the Builder), dots.
2. **`deal_of_day`** — mockup «⚡ عرض اليوم · بيخلص بالليل».
   - `{kicker ≤50, product_id req (TenantExists), title ≤90 (null = product name), chips string[] ≤4 (null =
     the product's spec_chips), ends: "midnight"|"date", ends_at (when date), stock_start int|null,
     button_label req ≤30, show_installment bool}`.
   - Price / old price / discount % from the product. Timer counts to Cairo midnight («midnight») or
     `ends_at`; hidden when ended (Builder shows a hint). Bar «اتباع X% من الكمية · فاضل N قطعة بس» only when
     the product tracks stock and `stock_start` > stock (X = (start − stock) / start).
3. **`services`** — «الضمان وخدمة ما بعد البيع»: `{title ≤80, items 2–4 {icon, title ≤40, text ≤120}}`
   (icons from the store icon set + `wrench`, `headset`, `badge-check`).
4. **`device_finder`** (T3) — «لاقي الإكسسوار المناسب لجهازك».
   - `{kicker ≤50, title req ≤80, text ≤200, brands 1–20 {name req ≤30, models 1–50 {name req ≤40,
     product_ids ≤8 (TenantExists), link (any link type incl. search)}}, type_label ≤30 (the third select's
     label, default «النوع»), types string[] ≤8 (optional third select that filters the shown products by
     category name; omit when empty)}`.
   - Selects: البراند → الموديل (→ النوع); results = the model's products (cards, 4 per row as the mockup's
     small result tiles) + «شوف الكل» to `link`. Server sends products per model in design data
     (`products["{id}:{b}:{m}"]`), so no request per click.
5. **`compare_table`** (T3) — «قارن قبل ما تشتري».
   - `{kicker ≤50, title req ≤80, product_ids 2–4, recommended_id nullable (one of them; its column gets the
     light-blue background and the «الأنسب ليك» chip), rows ≤12 {label req ≤60, best_id nullable (cell
     shown green bold)} (empty = every label the products share, in order), show_price bool, show_add bool}`.
   - Values from the products' specs (S1) matched by label; missing → «—». Bottom row «أضف للسلة» per
     column (blue for the recommended). Link «قارن أجهزة تانية ←» opens `/compare`.
6. **`buy_together`** (T3) — «كمّل جهازك ووفّر».
   - `{kicker ≤50, title req ≤80, product_id req, accessory_ids 1–3, button_label req ≤40}`.
   - Check boxes on each item (main checked and locked); total = sum of checked prices; «وفّرت X» only from
     real prices (sum of compare_at − sum of prices) — never invented; «أضف التلاتة للسلة» adds checked items
     (same add-all code as «رواق»'s routine; refuse with a message when one needs options or is out).
7. **`installments`** (T3) — the lime block «قسّط جهازك على راحتك».
   - `{kicker ≤50, title req ≤80, text ≤200, product_id nullable (the example; null = first product of the
     store), providers string[] ≤6 (null = from settings), note ≤120}`.
   - Month tiles from the `installments` settings group; selected tile = settings' `card_months`.
8. **`trade_in`** (T3) — «بدّل جهازك القديم بخصم على الجديد».
   - `{kicker ≤30, title req ≤80, text ≤200, steps string[3] (≤30 each), device_types string[] 1–8
     (default موبايل/لابتوب/تابلت/ساعة), conditions string[] 1–6 (default ممتاز/كويس/فيه عيوب),
     button_label req ≤30}`.
   - Form: نوع الجهاز (select), البراند والموديل (text), الحالة (select), رقم الموبايل → opens the store's
     WhatsApp (footer whatsapp) with a ready Arabic message containing the fields. Nothing stored. Without a
     store WhatsApp number: Builder hint, hidden on the live store.

Starter design (`defaults()`) in the mockup order, only sections that work without the merchant's
products: tech_hero (one slide, no product), features (5 items), categories («تسوّق حسب القسم»),
product_tabs («اختار جهازك»: الأكثر مبيعًا / وصل حديثًا / عروض), installments (product null), brands,
services, testimonials («آراء العملاء»). deal_of_day, device_finder, compare_table, buy_together and
trade_in need the merchant's products or answers: they come from the Builder gallery, pre-filled with the
mockup's Arabic copy (their product fields empty until he picks). The showcase demo (T4) shows all of them.

### 4.5 Settings groups
- Base groups: `look` (+ `colors.dark`, `colors.deal`, `display_font`), `header` (+ `hotline`, `track_link`
  bool, `search_categories` bool), `footer` (+ `help_links` ≤4 store page ids), `general`.
- `mega_menu`: `{enabled, items ≤10 {category_id, columns ≤2 {title ≤30, links ≤8 {label ≤30, link}}, promo
  {media_id, title ≤40, text ≤40, link} nullable}}`.
- `product_card` (§4.3), `product_page` (§4.6), `listing` (columns 3–5 desktop / 2 phone, filters
  `open|button`, show spec filters bool), `cart` (shared `PageSettingsGroups` like «رواق»).
- `installments`: `{enabled bool, months int[] subset of [3,6,9,12,18,24,36] (1–6), card_months (one of
  months), interest_percent 0–100 (0 = «بدون فوايد»; monthly = ceil(price × (1 + i/100) / months)),
  min_price int, providers string[] ≤6, note ≤120}`. **Display only** (not a payment method); text says
  «القسط تقريبي، والنهائي حسب شركة التقسيط». Installments are integer piastres math through `Money`, and
  never sent to checkout.

### 4.6 Product page (T2) — `tekno-2-product-page.png`, left
Layout desktop, as the image: **gallery on the right (start side), info on the left**; grid `1fr 1.05fr`,
gallery first in DOM (RTL puts it on the right).
- Breadcrumb.
- Gallery: big photo (zoom on hover setting), «🔍 كبّر الصورة» (opens a lightbox), «فيديو المنتج ▶» when
  `video_url` (opens the player like «رواق» reels), 5 thumbs (active blue border).
- Info: brand line (value of the spec row named `product_page.brand_label`, default «البراند», blue) ;
  title; stars + «(N تقييم) · موديل X · كود SKU» (موديل = spec row `product_page.model_label`, default
  «الموديل»; SKU from the product) + condition chip (spec row `card.badge_label`); **«أهم المواصفات في
  لمحة»**: 4 tiles = the `in_card` rows (label small, value bold); options as chips (storage) / color dots
  (swatches) with the price difference «+2,800 / -1,500»; **price box**: price, old price, red «وفّر X»,
  **installment calculator** (lime box, title «قسّطه من غير مقدم», month tiles «12 × 2,083», selected =
  `card_months`), stock line «فاضل N قطع بس في المخزن», buttons «أضف للسلة» (blue) «اشتري دلوقتي» (dark) «⇄
  قارن» «♡» (wishlist); **warranty chips** (3, from setting `product_page.promises` ≤3 `{icon, text}`,
  default «ضمان الوكيل سنتين / استبدال 14 يوم / صيانة معتمدة»); **delivery line** (dashed box): «🚚 لو في
  {governorate select} هيوصلك {days}» from the store's real shipping data (days_min/max of the cheapest
  available option; fee + free threshold). Hide the line when shipping isn't configured.
- Tabs: «المواصفات الكاملة» (groups as cards in a 2-column grid, group name with an icon by position),
  «في العلبة إيه» (the spec table whose name = setting `product_page.box_table`, default «في العلبة»,
  shown as chips; tab hidden when missing), «الضمان» (the table named `product_page.warranty_table`,
  default «الضمان», or the promises), «أسئلة العملاء (N)» (S3), «التقييمات (N)».
- Phone: gallery swipe, sticky bottom bar (price + «أضف للسلة»), tabs become accordions.
- **Compare bar** (dark, bottom): «أجهزة للمقارنة (2 من 4)» thumbs, empty «+» slots, «قارن دلوقتي»
  (cyan), «امسح». Shown on every page while the list isn't empty (above the phone bottom nav).

### 4.7 Other pages (T2)
Category/search: filters (price, availability, offers, **spec filters** S2), sort, grid of tekno cards,
banner, sub-categories chips. Compare page `/compare`: the compare table design of §4.4 #5 with the
visitor's products (remove per column, «أضف للسلة»). Wishlist `/wishlist`: grid + «امسح الكل». Cart,
checkout, done: shared logic (like «رواق»: own look, same hooks; transfer receipt / online gateway as the
others).

---

## 5. Copy (Arabic texts) — take them from the mockup HTML verbatim
All titles, kickers, buttons and placeholders in `mockup/home.html` and `mockup/product.html` are the
approved Arabic copy for the starter design / new-section defaults / visitor messages. Product names, brand
names, prices and reviews in the mockup are sample data for the **showcase demo** (T4) only.

## 6. Showcase, gallery, AI guide (T4)
- Demo `src/themes/store/tekno/demo.ts` (like `rawaq/demo.ts`) reproducing **both images**: same sections,
  same texts, same numbers, with **real free photos without visible brands or logos** (Unsplash CDN
  `images.unsplash.com/photo-…`, check every photo by eye; drop any with a logo). Put them in
  `front/public/themes/store/tekno/demo/`.
- Throwaway local store (`tekno-test.localhost`, own tenant, never the owner's demo) with the same products,
  spec groups and design — for the owner's review and for the 6 gallery pictures (1600×1000 WebP, same
  composition script idea as «رواق»: browser frame + phone frame + title + 3 points, «تيكنو» colors) in
  `front/public/themes/store/tekno/` and `THEME_SHOTS`.
- AI designer guide `back/resources/prompts/themes/tekno_store.md` (generated from `defaults()` like
  `rawaq_store.md`), `AiDesignRunner::defaultThemeColors`, front `tekno` AI tokens.
- Listing migration + final ThemeSeeder texts (selling description in Egyptian Arabic, 6 features).

## 7. Deviations from the images (decided — don't add others)
- The red «جديد» pills are annotations; not built.
- Real brand logos/names: never. Brands section = the merchant's own logos/names.
- «اشترى: …» under reviews: from S2 (review product name); manual reviews may type it (`product` text ≤60).
- Phone «قارن» in the bottom nav opens `/compare`.

## 8. File checklist (what «رواق» touched — «تيكنو» touches the same)
Back: `app/Themes/Store/TeknoStoreDesign.php`, `StoreThemes` registry, `StoreSections` (new types rules +
clean), `StoreDesigner::data()` (products per section/model, links), `Concerns/PageSettingsGroups`,
`lang/ar/themes/store/tekno.php`, `database/seeders/ThemeSeeder.php` (row, `listed => false` until T4),
`AiDesignRunner` colors, `resources/prompts/themes/tekno_store.md`, `AiSectionFields` link types if needed,
tests `tests/Feature/Themes/Store/TeknoStoreDesignTest.php` + `StoreThemesContractTest` must pass (starter
design validates unchanged — key order matters).
Front: `src/themes/store/tekno/{types,root,tekno.css,card,chrome,sections,tekno-store,demo,pages/*}`,
`themes/store/registry.tsx` (Frame/Home/Canvas/pages/aiTokens), `themes/store/demos.ts`,
`themes/registry.ts` (`THEME_SHOTS`, `THEME_DEMOS`), `features/builder/themes/{index,tekno}.ts(x)`,
`features/builder/tekno-forms.tsx`, `section-gallery.tsx` (`SECTION_LOOK` icons),
`messages/ar/design.ts` (`builder.types` + `tekno`), `messages/ar/themes/store/tekno.ts` + `ar.ts`,
`themes/shared/ai-section/tokens.ts`, tests `tekno-store.test.tsx` + `pages/pages.test.tsx`.

## 9. Review standard («100% right»)
For each stage, before reporting: compare your build with the images side by side (screenshot desktop 1440
and phone 390 of the same part, put them next to the image crop, fix differences in spacing, sizes, colors,
order, copy); no console errors; no horizontal scroll on phone; Builder forms for every new section and
setting; empty/loading/error states; front + back tests. Send the owner the comparison screenshots.

---

## PROGRESS LOG
(append one entry per finished stage: date, what was built, commit, decisions taken, what the owner must do)
