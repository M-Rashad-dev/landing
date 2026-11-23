# Merchant essentials — staff, WhatsApp confirmation, profit, cart recovery, refunds — plan

Owner, 2026-11-23: build 1 (staff accounts), 2 (order confirmation on WhatsApp), 3 (cost and profit), 5 (abandoned
cart recovery), 7 (refunds). Every stage stops for review. Plus the owner's question: can the WhatsApp messages
go from the store's own number instead of ours (§0).

## 0. WhatsApp: whose number sends
**Today**: every message (order updates, merchant alerts) goes from the platform's single number (Mksab WABA, see
memory «WhatsApp Cloud API setup»). The customer sees «مكسب» as the sender and the store's name in the text.

**The store's own number is possible**, through Meta's **Embedded Signup** (the merchant connects his own WhatsApp
Business account and number to our Meta app in a popup; we then send on his `phone_number_id`):
- We must become a Meta **Tech Provider**: our Meta business verified (commercial register / tax papers), the app
  reviewed for `whatsapp_business_messaging` + `whatsapp_business_management` advanced access, Embedded Signup v4+
  with session logging. Without verification this path is closed (the reason it was not done so far).
- **Coexistence**: a number already on the WhatsApp Business **app** can stay on the app and be used by the API at the
  same time (Business app ≥ 2.24.17, chats synced). Availability per country changes: check Egypt in Meta's docs at
  build time. Without coexistence the number must leave the app (a new number for the store is the simple case).
- Each merchant's number has its own **templates** (we create and submit them by API at connection) and its own
  messaging limits and quality rating.
- **Billing**: the merchant adds his own card in WhatsApp Manager and Meta charges him per message; the platform pays
  nothing for his messages.
- Customers' replies land on **his** number (button presses still reach our webhook through the app subscription).

**Decision proposed**: build the sender as a per-store layer now (like `StoreMailer` for email): `WhatsAppSender` →
the store's connected number when there is one, else the platform number. Ship everything on the platform number
first (works today, «مكسب» branding); add «اربط رقم واتساب متجرك» (Embedded Signup) as its own stage once the owner
has the papers and Meta approves us as Tech Provider. Nothing in stages 2 / 4 changes then.

**Cost on the platform number**: Meta charges per delivered template message (utility for order messages, marketing
for cart reminders — marketing is several times dearer). Replies inside the 24-hour window after the customer writes
are free. Who pays is the owner's call (question 1).

---

## Stage 1 — Staff accounts and permissions («الموظفين»)
**Goal**: the owner invites people (call center, warehouse, marketer) who sign in with their own account and see /
do only what he allows.

**Data**
- `users`: role `staff` (new `UserRole::Staff`), `permissions` json (list of keys), `invited_by`, `invited_at`,
  `accepted_at`. Owner stays `owner` (one per store, all permissions implicitly).
- `staff_invitations`: tenant, name, email, phone, permissions, token (hashed), expires_at (48 h), accepted_at.
- `activity_logs` (tenant): user_id, action key, subject type/id, summary (Arabic), meta json, ip, created_at.
- Plan limit `staff_accounts` (admin-editable like the others; proposed: basic 1, pro 3, max 10 — question 2).

**Permissions (fixed keys, grouped in the screen)**
| Key | Gives |
|---|---|
| `orders.confirm` | new orders + the confirmation queue only: call, contact attempts, confirm / cancel / fake, edit customer details |
| `orders` | all orders: statuses, shipping and shipments, airway bills, receipts (prepaid), deliveries, export |
| `products` | products, categories, imports, product files / codes, reviews |
| `customers` | customers, blocked list, abandoned carts |
| `marketing` | offers, coupons, upsells, landing pages, A/B tests, cart recovery settings |
| `design` | store design, themes (no buying), store pages |
| `shipping` | shipping companies, rates, carrier accounts |
| `analytics` | home KPIs, analytics |
| `profit` | costs and the profit report (stage 3) — separate so staff never see margins by default |
| `ai` | the copilot and AI designer (spends the AI balance) |
Owner only, never given: billing / plan / theme purchases, domains, staff, payment methods, store emails (SMTP
password), integrations (webhook secrets), account deletion, the AI wallet top-up.

**Screens**: «الإعدادات ← الموظفين»: list (name, phone, permissions summary, last sign-in, state), «ادعُ موظف» (name,
email, phone, permissions as checkboxes with presets «كول سنتر» / «مسئول شحن» / «مسئول منتجات» / «مدير»), edit
permissions, deactivate / reactivate, remove, resend invitation; «سجل النشاط» (filters: person, kind, date).

**Flows and cases**
- Invite → email (platform mail, store name) with a link `/invite/{token}` → the person sets his password (and name) →
  signed in. Email or phone already used by any account → refused with a clear message (accounts are platform-wide).
- Expired / used / revoked link → a page saying so; the owner can resend.
- Staff sign in on the same login page; `/auth/me` returns role + permissions; the sidebar, home cards and buttons
  hide what he can't do; every API route checks the permission (`permission:orders` middleware) → 403 with
  «مش مسموح لك» (the front already has `errors.forbidden`).
- Changing permissions or deactivating takes effect at once (the token stays but the check is live; deactivation
  revokes tokens).
- Plan downgrade below the staff count: extra staff are deactivated (newest first), the owner is told; reactivating
  needs a seat.
- Notifications: the bell / outside copies go only to users whose permissions cover them (new order → `orders` or
  `orders.confirm`; low stock → `products`; plan / billing → owner only).
- Copilot: acts as the signed-in user; its resources / actions are filtered by his permissions (orders actions need
  `orders`, product edits need `products`, profit report needs `profit`).
- `orders.confirm` staff see order totals but not costs / profit; never see payment method account settings.
- Activity log: status changes (already in order logs, linked), product price / stock edits, deletions, refunds,
  receipt approvals, permission changes, sign-ins. Kept 180 days.
- The owner can't remove or demote himself; staff can't invite.
- Tenant isolation: staff belong to one store (`tenant_id`); all existing scopes apply unchanged.
**Tests**: invitation lifecycle, every permission key vs its routes (allowed / 403), owner-only routes, notifications
routing, copilot filtering, plan limit, isolation.

---

## Stage 2 — Order confirmation on WhatsApp («تأكيد الطلبات أوتوماتيك»)
**Goal**: a cash-on-delivery order gets a WhatsApp message with buttons «أكّد الطلب» / «الغي الطلب» / «عايز أكلم
حد»; the order moves by itself; only the rest reach the call center.

**Settings** («الطلبات ← تأكيد الطلبات», permission `orders`): on / off; send right away or after N minutes; one
reminder after N hours without a reply (on / off, default 6 h); after the final wait (default 24 h) without a reply:
leave in the queue marked «ماردّش» (default) or cancel; «الغي» from the customer: cancel at once (default) or mark for
a call.

**Data**: orders `confirm_state` (null | sent | reminded | confirmed | cancelled | needs_call | no_reply | failed),
`confirm_sent_at`, `confirm_replied_at`; settings row per store.

**Template** (utility, platform number): `order_confirm_v1` «طلبك رقم {{1}} من {{2}}: {{3}} بإجمالي {{4}} جنيه، هيوصلك
{{5}}. أكّد الطلب عشان نجهّزه.» + 3 quick-reply buttons whose payload carries the order id + an HMAC; reminder
`order_confirm_reminder_v1`. Submitted with the existing templates command; the feature stays hidden until approved.

**Flow**
1. COD order created (store or landing page), customer agreed to WhatsApp (the checkout checkbox; wording becomes
   «أكّد طلبك وتابعه على واتساب») and the setting is on → `order_confirm` instead of `order_received` (never both).
2. Webhook gets a `button` message → payload checked → the order (audited `withoutTenant` by id + HMAC) → still
   `new`? → confirm: `ChangeOrderStatus` → confirmed (note «اتأكد من العميل على واتساب», no user) + a free reply «تمام،
   طلبك اتأكد»; cancel: → cancelled + reply; call: `needs_call` + merchant bell + reply «المتجر هيكلمك قريب».
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
- Realised revenue = delivered orders (owner can switch to «من وقت الشحن»; question 5) minus refunds (stage 5).
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

**Consent first**: WhatsApp reminders need the customer's consent. The checkbox moves next to the phone field
(store checkout and landing forms) and is sent with the lead capture; leads without it get email only (when an
email is known: signed-in customer or typed email). Email reminders carry an unsubscribe link.

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
1 staff → 2 WhatsApp confirmation → 3 profit → 4 cart recovery → 5 refunds. The per-store WhatsApp sender layer (§0)
is built inside stage 2 so a store number can be added later without touching stages 2 and 4.

## Questions for the owner
1. WhatsApp messages on our number cost money per message (cart reminders more): included in the plans (a monthly
   number per plan), charged from the merchant's balance (the AI wallet becomes «رصيد المتجر»), or free for now?
2. Staff seats per plan (proposed basic 1 · pro 3 · max 10)?
3. Confirmation: when the customer presses «الغي», cancel at once (proposed) or mark for a call?
4. Cart reminders: 2 reminders (1 h, 24 h) with an optional coupon on the second (proposed)?
5. Profit: count an order's revenue when delivered (proposed) or when shipped?

## PROGRESS LOG
