# Merchant essentials — staff, WhatsApp confirmation, profit, cart recovery, refunds — plan

Owner, 2026-11-23: build 1 (staff accounts), 2 (order confirmation on WhatsApp), 3 (cost and profit), 5 (abandoned
cart recovery), 7 (refunds). Every stage stops for review. Plus the owner's question: can the WhatsApp messages
go from the store's own number instead of ours (§0).

## 0. WhatsApp: whose number sends (owner decided)
Every WhatsApp message goes from **the platform's number** (Mksab), the store's name in the text; it doubles as
marketing for Mksab. **Nothing is built for stores sending from their own number** (no sender layer, no Embedded
Signup). Meta's route exists (Tech Provider + Embedded Signup + coexistence) if it is ever wanted.

---

## Stage 1 — Staff accounts and permissions («الموظفين»)
**Goal**: the owner adds people who sign in with their own account and see / do only what they are given — for
**every** dashboard page and every action on it. Nothing is owner-only by design: the owner (or a staff member who
has the «الموظفين» permissions) decides.

**Package (owner's choice)**: `spatie/laravel-permission` — permissions given directly to users (a user belongs to
one store, so no teams). Logged in DECISIONS.md.

**Data**
- `users`: role `staff` (new `UserRole::Staff`); `invited_by`, `invited_at`, `accepted_at`. The owner keeps `owner`:
  every permission implicitly (Gate::before), can't be edited, demoted or removed by anyone.
- spatie tables (permissions, model_has_permissions…); the permission list lives in code
  (`App\Auth\PermissionCatalog`: page → actions, Arabic labels) and is synced by `permissions:sync` (run by a
  migration now and by `deploy.sh` later).
- `staff_invitations`: user_id, token hash, expires_at (48 h), used_at.
- `activity_logs` (tenant): user, permission used, method + path, subject id, Arabic summary, ip, at (kept 180 days).
- Plan limit `staff_accounts` (defaults basic 1 · pro 3 · max 10; the platform owner edits them in the admin plans
  page like any limit); the admin store page lists the store's staff.

**Permission catalog (page → actions)** — `view` opens the page; the rest are its buttons:
| Page | Actions |
|---|---|
| الرئيسية | view |
| مساعد مكسب الذكي | use |
| الطلبات | view, update (customer details, note, contact attempts), status (change / bulk), confirm (confirmation queue), export, ship (shipments, airway bills, courier), payments (receipts accept / reject), deliveries (digital: resend, more downloads, «تم التنفيذ»), refunds (stage 5) |
| الطلبات المتروكة | view, update, delete, recovery (stage 4 settings + message packs) |
| العملاء | view, update, block |
| التقييمات | view, update |
| المنتجات | view, create, update, delete, import, digital (files / codes), cost (stage 3) |
| التصنيفات | view, create, update, delete |
| الشحن | view, update (fees, companies, offers), carriers (connect / disconnect / pickups) |
| إعدادات المتجر | view, update |
| الثيم والرئيسية | view, update (builder), publish, switch (change / buy theme) |
| الصفحات الثابتة | view, create, update, delete |
| العروض · الكوبونات · عروض ما بعد الطلب | view, create, update, delete (each page its own) |
| صفحات الهبوط | view, create, update, delete, publish, ab_tests |
| التحليلات | view; الأرباح (stage 3): view, expenses |
| النطاقات | view, manage |
| الباقة والفواتير | view, pay (checkout, receipts) |
| رصيد الذكاء الاصطناعي | view, topup |
| البيكسلات · الربط · الدفع · الإيميلات | view, update (each page its own) |
| الموظفين | view, create, update, delete |
| سجل النشاط | view |
| الدعم | use (support chat) |
Everyone keeps his own profile / password / notifications.

**Enforcement**: one map from every dashboard route (method + path) to its permission (`config/permissions.php`),
checked by a middleware on the dashboard group: the owner passes, staff need the permission, **a route missing from
the map is refused** (fail-closed) and a test fails when any dashboard route is unmapped. 403 «مش مسموح لك تعمل ده».

**Screens**: «الإعدادات ← الموظفين»: list (name, phone, email, state: invited / active / stopped, last sign-in),
«ضيف موظف» (name, email, phone + the permissions tree: a checkbox per page with its actions, «كل الصلاحيات»,
quick presets كول سنتر / شحن / منتجات / تسويق that just tick boxes), edit, stop / resume, delete, resend the link;
«سجل النشاط» (person, page, date). The front reads the user's permissions from `/auth/me`: the sidebar shows only
pages he can view, buttons he can't use are hidden, a page opened by link shows «مش مسموح لك».

**Cases**
- Add staff → account created (no usable password) + email (platform mail, the store's name) with «اعمل كلمة السر»
  link `/invite/{token}` → sets password → signed in. Expired / used link → message; the owner can resend.
- Email or phone already used by any account → refused (accounts are platform-wide).
- A staff member who manages staff can only give permissions he has himself; nobody touches the owner.
- Permission changes / stopping take effect on the next request; stopping or deleting revokes his sessions.
- Seats: adding beyond the plan's limit → the usual «رقّي باقتك»; after a downgrade the newest extra staff are
  stopped and the owner is told.
- Notifications go only to people whose permissions cover them (new order → orders.view; low stock → products.view;
  receipts → orders.payments; plan / invoices → billing.view; mailbox → emails.view…).
- Copilot: works as the signed-in person — only resources / actions his permissions allow (and `copilot.use`).
- Activity log: every successful change (POST / PUT / PATCH / DELETE) by anyone, plus sign-ins.
- Tenant isolation unchanged (staff carry the store's tenant_id).

---

## Stage 2 — Order confirmation on WhatsApp («تأكيد الطلبات أوتوماتيك»)
**Goal**: a cash-on-delivery order gets a WhatsApp message with buttons «أكّد الطلب» / «الغي الطلب» / «عايز أكلم
حد»; the order moves by itself; only the rest reach the call center.

**Settings** («الطلبات ← تأكيد الطلبات», permission `orders`): on / off; send right away or after N minutes; one
reminder after N hours without a reply (on / off, default 6 h); after the final wait (default 24 h) without a reply:
leave in the queue marked «ماردّش» (default) or cancel. «الغي» always cancels at once (owner).

**Data**: orders `confirm_state` (null | sent | reminded | confirmed | cancelled | needs_call | no_reply | failed),
`confirm_sent_at`, `confirm_replied_at`; settings row per store.

**Template** (utility, platform number): `order_confirm_v1` «طلبك رقم {{1}} من {{2}}: {{3}} بإجمالي {{4}} جنيه، هيوصلك
{{5}}. أكّد الطلب عشان نجهّزه.» + 3 quick-reply buttons whose payload carries the order id + an HMAC; reminder
`order_confirm_reminder_v1`. Submitted with the existing templates command; the feature stays hidden until approved.

**Flow**
1. COD order created (store or landing page), customer agreed to WhatsApp (the checkout checkbox; wording becomes
   «أكّد طلبك وتابعه على واتساب») and the setting is on → `order_confirm` instead of `order_received` (never both).
2. Webhook gets a `button` message → payload checked → the order (audited `withoutTenant` by id + HMAC) → still
   `new`? → confirm: `ChangeOrderStatus` → confirmed (note «اتأكد من العميل على واتساب») + reply «شكرًا لحضرتك،
   وجاري تجهيز طلبك»; cancel: → cancelled at once, logged «اتلغى من العميل» (owner) + reply «تم إلغاء طلبك»; call:
   `needs_call` + merchant bell + reply «تمام، حد من المتجر هيتواصل معاك قريب». (Replies are free: inside the 24-hour
   window the customer opened.)
3. Not `new` anymore (merchant already acted, or a second press) → reply with its current state, change nothing.
4. Customer writes text instead of pressing → while a confirmation is open (48 h) → `needs_call` + bell, reply «المتجر
   هيكلمك» (the general auto-reply stays for everything else).
5. No reply → reminder once → then `no_reply` (or cancel, per setting).
6. Send failed (no WhatsApp on the number, Meta error) → `failed`; the order stays in the queue as today.
7. Customer didn't agree to WhatsApp, prepaid orders, blocked customers, WhatsApp not configured → nothing sent.
8. Several open orders for one phone → each message has its own buttons; each press acts on its order.
- Confirmation queue: shows `confirm_state` (column + filters «مستني رد» / «ماردّش» / «عايز يكلم حد» / «فشل»); the
  home card «محتاج منك» counts only orders still needing a call.
- Analytics: confirmation rate by WhatsApp, cancellations, response time.
- Copilot: orders resource reads `confirm_state`; nothing new to act.
**Tests**: each button, replays and forged payloads, states, reminder / timeout job, opt-out paths, tenant isolation.

---

## Stage 3 — Cost and profit («الأرباح»)
**Goal**: the merchant knows what he really earned, per order, per product, per period.

**Data**
- `products.cost` (decimal, nullable), `product_variants.cost` (optional override per combination).
- `order_items.unit_cost` snapshot at order time (later cost edits never change past orders); orders from before →
  «تكلفة مش معروفة» and left out of margins (shown separately).
- Shipping company: `cost` per governorate (what the carrier charges the store; empty = the fee charged to the
  customer), `return_cost` (empty = same as cost), `cod_fee_percent` (carrier's collection fee). Snapshot on the order
  when it ships.
- Store costs setting: packaging per order (fixed), and **expenses** table: date, kind (ads: facebook / tiktok /
  google / snapchat / other; other: salaries, rent, tools…), amount, note. Ads can be split by UTM source.

**Rules**
- Two figures (owner): **الربح المتوقع** = orders still in progress (awaiting payment / new / confirmed / shipped),
  **الربح الفعلي** = delivered orders whose steps are all done; both minus refunds (stage 5).
- Order profit = items total after discounts − product costs − shipping cost (− the shipping fee paid by the
  customer is revenue) − COD fee − packaging.
- Returned / damaged orders: lost shipping both ways (cost + return_cost) count as a loss; product cost back to
  stock for returned, lost for damaged.
- Cancelled / fake: no cost (unless shipped then returned).
- Gifts (offer gift items): their product cost counts against the order.
- Digital products: cost optional (often 0).

**Screens**: product form «سعر التكلفة» (+ per combination in stock editor), margin column in products, cost
column in Excel import; shipping company form costs; «التحليلات ← الأرباح» (period: sales, product cost, shipping,
returns, ads, other expenses, net profit, margin, ROAS, per product table, per source / landing page with its ads,
orders without cost warning) and «المصاريف» (add / edit / delete expenses); order page profit box. All behind
permission `profit`.

**Cases**: cost missing on some items (partial, flagged), price changed after the order (snapshot), mixed carts,
partial refunds, re-opened cancelled orders, currency EGP only.
**Copilot**: report `profit` (period, by product / source) for users with `profit`; resource `expenses` (read, create).
**Tests**: each formula case, snapshots, permission, isolation.

---

## Stage 4 — Abandoned cart recovery («استرجاع السلات المتروكة»)
**Goal**: an abandoned checkout / landing form gets reminders by itself; the merchant sees what came back.

**Who gets it (owner)**: every abandoned lead with a phone gets the WhatsApp reminders automatically (no consent
checkbox); email reminders too when an email is known (with an unsubscribe link). Note: on the platform's shared
number, people reporting reminders as spam lower the number's quality for every store — the stop rules below and
«stop» replies keep that low.

**A paid feature with message packs (owner)**: the merchant turns recovery on in «الطلبات المتروكة»; WhatsApp
reminders use **his message balance** (one reminder = one message). He buys packs there (e.g. 100 / 500 / 1000
messages, prices set by the platform owner in the admin) → an invoice in «الباقة والفواتير» paid like any invoice
(manual receipt today, the gateway later) → the balance goes up when the invoice is paid. Balance 0 → WhatsApp
reminders stop (emails go on), the merchant is told once, and the page shows «اشحن رسائل».

**Settings** («التسويق ← السلات المتروكة», permission `marketing`): on / off per channel; reminder 1 after N minutes
(default 60), reminder 2 after N hours (default 24, optional) with an optional coupon (an existing code, or «كود
لمرة واحدة» generated per lead: percent / amount, valid 48 h); quiet hours (no sending 11 pm – 9 am Cairo, held for
the morning).

**Templates**: marketing `cart_reminder_v1` («نسيت طلبك في {{1}}؟ {{2}} لسه مستنيك…», URL button to the restore link)
and `cart_reminder_coupon_v1` (with the code). Email versions in the store's name (StoreMailer).

**Restore link** `https://{store}/r/{token}`: store leads refill the cart (the lead keeps its cart) and open the
checkout with name / phone filled; landing leads open the page's form filled; expired / used → the store home.

**Stop when**: the phone ordered (any order in the store since the lead), the lead was contacted / dismissed by the
merchant, the customer is blocked, replied «stop» / unsubscribed (opt-out list per store), 2 reminders sent, the
lead is older than 3 days, products in the cart left the store (then only the landing / home link).

**Tracking**: leads get `reminders_sent`, `last_reminded_at`, `recovered_at` (an order within 7 days of a reminder →
«رجعت بالتذكير»); the abandoned page shows these; analytics: recovered orders and revenue, per reminder.
**Copilot**: abandoned leads resource reads the reminder fields.
**Tests**: scheduling, every stop rule, consent, quiet hours, coupons single-use, restore links, isolation.

---

## Stage 5 — Refunds («المرتجعات والمبالغ المسترجعة»)
**Goal**: when money already collected goes back to a customer, it is recorded, the customer is told, and reports
are right.

**Applies to** orders with money in: prepaid orders paid (stage 3 of the previous plan), and cash-on-delivery orders
delivered (cash collected; the customer returns later).

**Data**: `order_refunds`: order, amount, items (optional list: item id + quantity, for partial), reason, method
(the payment method used, or wallet / InstaPay / bank / cash), destination (the customer's number / account; default
the receipt's «حوّل من»), reference, proof image (optional), status (pending → done | cancelled), created_by,
done_by, done_at. Orders: `refunded_total`, payment_status gains `partially_refunded` / `refunded`.

**Flows and cases**
- Cancelling a paid prepaid order → the dialog asks «هترجّع الفلوس؟» (كله / جزء / لا) → a refund «مطلوب» is created.
- Returning a delivered order → same question.
- Any time from the order page: «رد مبلغ» (partial: choose items / amount, never above what was paid minus refunds).
- Pending refunds list («الطلبات ← مبالغ مطلوب ترجيعها») → «اترجّع» with reference / proof → the customer gets an email
  (and the pay page shows it); cancel a pending refund.
- Digital lines: refunding them can stop downloads / the link (checkbox; codes already sent can't be taken back — said
  in the dialog).
- Stock: a refund with returned items can put them back in stock (checkbox), once.
- Coupons used, gifts, shipping fee: the dialog suggests the amount (paid total by default) and the merchant decides.
- Webhook event `order.refunded`; Sheets row update.
- Reports: sales net of refunds (stage 3), refunds per period.
- Permission: `orders` creates and completes; activity log records them.
- Copilot: refunds resource (read); no refund actions (money stays with the merchant).
**Tests**: amounts and limits, partial items, states, digital revoke, stock, permissions, isolation.

---

## Order of work
1 staff → 2 WhatsApp confirmation → 3 profit → 4 cart recovery → 5 refunds. Each stage also extends the copilot
(resources / reports / actions, permission-aware).

## Answers (owner, 2026-11-23)
1. Cart recovery is a feature the merchant turns on; its WhatsApp messages come from packs he buys (invoices).
2. Staff seats: any defaults, editable in the admin.
3. «الغي» cancels at once, logged as cancelled by the customer.
4. Profit: both — expected (in progress) and actual (delivered, all done).
5. Every feature is added to the copilot.
6. (2026-11-23) Only cart-recovery WhatsApp messages are paid (packs); everything else stays free — the confirmation
   included, with no limit.

## PROGRESS LOG
- **2026-11-23 — Stage 1 staff accounts, built.** `spatie/laravel-permission` (direct user permissions, guard `web`,
  `HasRoles` on User); `UserRole::Staff`; users `invited_by` / `invited_at` / `accepted_at` / `locked_by_plan`;
  `staff_invitations` (sha256 token, 48 h, once); `activity_logs` (180 days, `activity:prune`). `App\Auth\PermissionCatalog`
  (28 pages × their actions, Arabic labels, `permissions:sync` — run by the migration and by deploy.sh); every dashboard
  route mapped in `config/permissions.php` («routes»: 247, @any for shared lookups, @self for the person's own things) and
  checked by `EnforceStaffPermissions` on the dashboard group (fail-closed; a test fails on any unmapped route); it also
  writes the activity log for every successful change, sign-ins too. `App\Auth\StaffAccounts`: add (plan limit
  `staff_accounts`: basic 1 · pro 3 · max 10, admin-editable; downgrades lock the extra staff through PlanLocks), edit,
  stop (tokens revoked), delete, resend; nobody gives what he doesn't hold or touches the owner. Invitation email →
  `/invite/{token}` (Next `/api/auth/invitation/check|accept`, the token kept in the cookie like a login). `/auth/me`
  returns the permissions (owner `["*"]`). Notifications go to people whose permissions cover the event
  (`NotificationEvent::permission()`). Copilot: capabilities filtered by the person's permissions
  (`config/permissions.php` «copilot»: read / create / update), report `staff` (staff + latest activity). Admin store page
  lists the staff. Front: sidebar / quick search / settings tabs filtered, `PermissionGate` («مش مسموح لك», home →
  first allowed page), `useCan()` hides the main buttons (products add / import, orders export / status / ship, the
  confirmation queue), «الإعدادات ← الموظفين» (permission tree with presets) and «سجل النشاط». Tests:
  `tests/Feature/Staff/StaffTest.php`, `front/src/features/settings/staff.test.tsx`.
- **2026-11-23 — Stage 2 WhatsApp order confirmation, built (free, no limit).** `order_confirmation_settings` (on / off,
  delay, one reminder, final wait, keep or cancel on timeout) and orders `confirm_state` / `confirm_sent_at` /
  `confirm_reminded_at` / `confirm_replied_at` (`ConfirmState`). Templates `order_confirm_v1` and
  `order_confirm_reminder_v1` (utility, 3 QUICK_REPLY buttons whose payload `oc:{action}:{order}:{hmac}` is set at send
  time); the feature shows as unavailable until Meta approves `order_confirm_v1` (push from «الرسائل» in the admin).
  `App\Orders\WhatsAppConfirmations`: `CustomerNotices::received` sends the confirmation instead of «received» for COD
  orders whose customer agreed to WhatsApp (`SendOrderConfirmation`, after the delay; «received» goes if it can't);
  button presses in the webhook → confirmed (note «اتأكد من العميل على واتساب») / cancelled at once (logged «اتلغى من
  العميل», no extra «cancelled» template) / needs_call, each with the owner's reply text (free, inside the window); a
  pressed order already moved → its current state; forged / other-phone payloads ignored; a written message while a
  confirmation is open (48 h) → needs_call; `orders:confirmations` (every 10 min) reminds once and closes (no_reply or
  cancel); a failed delivery status → `failed`. Merchant bell `customer_reply` (cancel, call). Confirmation queue: needs
  call first, waiting answers last and not counted as due, `waiting_whatsapp`, badges; `?confirm=` filter; settings panel
  on the queue page (permission `orders.auto_confirm` to change). Checkout checkbox «أكّد طلبك وتابعه على واتساب».
  Copilot: orders `confirm_state`. Tests: `tests/Feature/Orders/WhatsAppConfirmationTest.php`,
  `front/src/features/orders/whatsapp-confirm.test.tsx`.
