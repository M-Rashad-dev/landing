# Digital products, prepaid orders, store emails, custom inputs — plan

Owner, 2026-11-22. Dropshipping is out of the plan for now (owner). Other product kinds (bookings, subscriptions,
bundles, pre-orders) are not now.

## 1. What the owner decided
- **One product kind «منتج رقمي»** with a delivery type: **files**, **codes**, **links**, **services**. Everything is
  delivered by email (the customer's account email, else a required email field at checkout) and also shown on the
  order / tracking page.
- **Paid before delivery.** Digital orders are prepaid: the customer picks one of the store's payment methods
  (InstaPay, Vodafone Cash / wallets, the merchant's own payment link), pays, uploads the receipt; the merchant
  confirms it, and only then automatic deliveries go out. An online gateway, if one comes, plugs into the same step.
- **Emails, two choices, in order:** (1) from the platform, with the store's name as sender and replies going to the
  merchant (default); (2) from the merchant's own mailbox (SMTP with an app password, e.g. Gmail 2FA), his own limits.
- **Custom products («حسب الطلب»)** stay normal products: new option kinds let the customer type text, a long text, or
  upload an image / file at checkout.

**Answers (owner, 2026-11-22):** mixed carts allowed (the whole order is then prepaid); landing pages sell digital
products too (address / shipping hidden); a product with options has its own codes per variant (e.g. 60 UC / 325 UC);
digital products on every plan, ≤ 100 MB a file, counted in the plan's storage. Files: several per product, each with
its own name (a file input + a name, «+» adds another).

**Platform mail:** Hostinger, `noreply@mksab.store`, `smtp.hostinger.com` 465 (SSL; 587 STARTTLS works too), login
checked 2026-11-22. DNS on mksab.store already has SPF (`include:_spf.mail.hostinger.com`), DKIM
(`hostingermail-a/b/c`) and DMARC (`p=none`). The password goes only in the server `.env` (the owner sets it).

## 2. Delivery types
| Type | Merchant sets | After payment is confirmed |
|---|---|---|
| Files | one or more files (PDF, Word, ZIP, images, video…), each with its own name shown to the customer, downloads per purchase (1, 2, … or unlimited) | email + download buttons; each download counts; when used up the link says so (not a 404); the merchant can grant more for an order |
| Codes | an ordered list of entries (each a multi-line text: a code, or email + password…), each with how many times it can be sent; drag to reorder; paste many at once | the next entry with sends left goes to the customer (one per unit bought), by email and on the order page; low-stock alert; product unavailable when none left; «resend» never takes a new one |
| Links | the URL, opens per purchase | email + a link through us (`/d/{token}`) that counts opens, then sends the customer on |
| Services | the email template (subject + text with {name}, {order}, {product}…) | nothing automatic: the order waits for the merchant; he does the work (followers, top-up…), presses «تم التنفيذ», can edit the message, and the email goes |

Every type has a delivery message template (default text ready, the merchant edits it per product).

## 3. Flow
1. Product form: «منتج رقمي» switch → delivery type → its settings (files / codes / link / service template).
   Digital products have no weight / shipping; stock = codes left (codes) or unlimited.
2. Checkout (store and landing pages): a cart / form with a digital product asks for the email (required, saved to the
   customer's account), hides address and shipping when everything is digital, and shows the store's payment methods
   with their instructions; the receipt is uploaded right there or later from the order / tracking page.
3. Order status **«بانتظار الدفع»** (new): receipt sent → the merchant sees it in the order and in a «مدفوعات للمراجعة»
   filter → **confirm** (order → confirmed, deliveries run) or **reject with a reason** (customer emailed, can upload
   again). Unpaid orders are cancelled after N days (setting, default 3).
4. Delivery engine (after confirmation, queued, idempotent): files / links / codes delivered and emailed, the order
   moves to «تم التسليم» by itself when everything was automatic; services wait for «تم التنفيذ».
5. Customer sees everything on the order / tracking page (downloads, codes, links) and in his account.

## 4. Emails
- Platform mail (default): From «{store name} <no-reply@…>», Reply-To = the store's contact email.
- Merchant SMTP (optional): host, port, encryption, username, app password (encrypted), from name / address; presets
  for Gmail / Outlook / Zoho; «ابعت إيميل تجربة»; if it fails, that email goes through the platform mail and the
  merchant is told. Used for every customer email of the store (order messages too), not only digital deliveries.
- Server needs: `MAIL_MAILER=smtp`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_SCHEME`
  (smtps / null), `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`, plus SPF / DKIM / DMARC records on the sending domain.

## 5. Custom inputs («حسب الطلب»)
New option kinds next to buttons / dropdown / colour: **text**, **long text**, **image / file upload** (allowed types,
≤ 10 MB, required or not, optional extra price). They don't make variants. The customer fills them on the product page
(store) or in the form (landing page); uploads go to private storage, linked to the order item; the merchant sees and
downloads them in the order. Services use them too (e.g. the account to add followers to).

## 6. Security
Files and uploads on a private disk, served only through signed / counted routes; codes encrypted in the database,
never in webhooks, Google Sheets rows, logs, exports or the copilot (counts only); download / link tokens unguessable;
rate limits on uploads, downloads and receipt submissions; receipts visible to the store only.

## 7. Copilot
Products resource learns the digital fields (type, codes left, downloads); actions: add codes to a product (from text or
an attached sheet), deliver a service order with its message. Confirming payments stays with the merchant (money).

## 8. Stages (each stops for review)
1. **Store emails**: Reply-To, merchant SMTP settings + test + fallback, delivery log.
2. **Custom inputs**: text / long text / upload option kinds, checkout uploads, order view.
3. **Prepaid orders**: store payment methods, «بانتظار الدفع», receipt upload, review (confirm / reject), auto-cancel.
4. **Digital products**: kind + types, checkout email, delivery engine, files, links, codes, services, order / tracking
   page, templates, copilot, docs.

## PROGRESS LOG
- **2026-11-22 — Stage 1 store emails, built.** `store_mail_settings` (+ `outbound_messages.via`), `App\Mail\Store`
  (`Mailbox` / `SmtpMailbox` / `FakeMailbox`, `StoreMailer`, `StoreMailSettings`), `/dashboard/mail-settings` (show,
  save with login check, forget, test email), `mailbox_failed` notice, copilot resource `mail_settings` (read only),
  settings tab «الإيميلات» (Gmail / Outlook / Zoho / Hostinger presets), order message log shows «من إيميلك».
  `DeliverCustomerNotice` sends through `StoreMailer`. Checked live: login to the Hostinger mailbox through
  `SmtpMailbox` (465 SSL and 587 STARTTLS, wrong password → the auth message). Tests: `tests/Feature/Messaging/StoreMailTest.php`,
  `front/src/features/settings/mail-page.test.tsx`. Also fixed: `SaveBar` buttons were submit buttons (double save).
- **2026-11-22 — Stage 2 custom inputs («حسب الطلب»), built.** `product_inputs` (kind text / textarea / image /
  file, label, placeholder, required, extra price; ≤ 5 a product, no variants) and `customer_uploads` (private disk
  `customer-uploads/{tenant}/{Y-m}`, 40-char token, claimed once by an order line, unclaimed ones deleted daily by
  `uploads:prune`). `PriceCalculator::resolveInputs` checks required / length / token and adds the extra price (offers
  see it like option deltas). Orders (store cart + landing pages) keep the answers in `order_items.options` after the
  option values (`kind`, `input_id`, files as their name + `upload_id`), so the order page, invoice, webhooks, Sheets
  and exports show them as before. Public `POST /public/uploads` (Next `/api/public/uploads`, ≤ 10 MB, type read from
  the file, 10 / min per visitor); dashboard download `GET /dashboard/orders/{order}/uploads/{id}` (always an
  attachment, nosniff). Products with a required field are never quick-added, given as a gift or offered one-click;
  the «صوفي» featured-product section sends them to their page. Front: product form section «حسب الطلب»
  (`inputs-editor.tsx`), shared `themes/shared/customer-inputs.tsx` (hook + fields, drawn by «أساس», «شابع» and the
  three landing order forms), cart lines keyed by the answers, order page shows the answers with file downloads.
  Copilot: products resource reads the fields. Tests: `tests/Feature/Store/CustomInputsTest.php`,
  `front/src/themes/shared/customer-inputs.test.tsx`, `front/src/app/api/public/uploads.test.ts`.
- **2026-11-22 — Stage 3 prepaid orders, built.** `store_payment_methods` (kind instapay / wallet / bank / link,
  name, account, https link, instructions, on / off; ≤ 10), `store_payment_settings` (cash on delivery on / off — always
  on while no prepaid method is active — and cancel-after days, default 3), orders `payment_method` (cod | prepaid),
  `store_payment_method_id`, `payment_method_name`, `payment_status` (unpaid | review | paid), `paid_at`;
  `order_payments` (receipts on the private disk `order-receipts/{tenant}/{order}`). New order status
  `awaiting_payment` (→ confirmed / cancelled / fake). `App\Store\Payments\StorePayments`: checkout choice, receipt,
  approve (= confirm through ChangeOrderStatus, which marks it paid), reject with a reason, `orders:cancel-unpaid`
  (hourly, skips orders with a receipt waiting). Checkout (store + landing pages) sends `payment_method`; the answer
  carries `pay_url` = `https://{store's primary host}/pay/{track token}`: one pay page for every store and landing page
  (`front/src/app/sites/[host]/pay/[token]`, `themes/shared/pay-view.tsx`), linked from «طلبك وصل», the tracking page and
  the emails (`payment_due` / `payment_confirmed` / `payment_rejected`, email only). Merchant: «الإعدادات» → «الدفع»,
  the order's «الدفع مقدمًا» card (receipt preview, «الفلوس وصلت» / «ارفض الإيصال»), the «بانتظار الدفع» tab and
  `?payment=review`, bell `payment_receipt`. Copilot: `payment_methods` resource, orders' payment fields; it never confirms
  an order waiting for its payment. Tests: `tests/Feature/Orders/PrepaidOrdersTest.php`,
  `front/src/themes/shared/pay-view.test.tsx`, `front/src/features/settings/payments-page.test.tsx`.
- **2026-11-22 — Stage 4 digital products, built (the plan is complete).** Products `kind` (physical | digital),
  `delivery_type` (files | codes | links | services), `delivery_settings` (encrypted: downloads, link + opens, message
  subject / text with {name} {order} {product} {store}); `product_files` (private disk `product-files/{tenant}/{product}`,
  ≤ 10 a product, ≤ 100 MB each, in the plan's storage, scripts / pages refused); `product_codes` (encrypted, per option
  combination like variant stock, uses_total / uses_left, sent in position order, never twice to one buyer);
  `order_items.delivery_type`; `order_deliveries` (one per line: 40-char token, encrypted payload, usage per file / link,
  limit + bonus). Checkout: a cart / page with a digital product is prepaid (no COD), needs the email (saved to the
  customer), and with nothing physical asks no address and charges no shipping; digital products show as unavailable
  without an active prepaid method. Delivery: confirming the order (receipt accepted) runs `DeliverDigitalOrder` →
  `App\Store\Digital\DigitalDeliveries` (files / links / codes at once, services wait for «تم التنفيذ»; codes out →
  pending + merchant alert, filled when codes are added); one email per line through `StoreMailer` (codes in it);
  an order with only digital lines becomes «تم التسليم» by itself (no second email). Customer: the pay page lists
  «منتجاتك» (downloads with what's left, codes with copy, the link through `/api/public/open/{token}`, a service's
  state); downloads stream through `/api/public/downloads/{token}/{file}` (counted first; a readable page once used up);
  the tracking page links «افتح منتجاتك». Merchant: product form «نوع المنتج» (types, files with names, codes manager:
  per combination, paste one per line or blank-line separated, uses, reorder, uses left), order card «المنتجات
  الرقمية» (codes sent, downloads used, resend, one more download / open, «تم التنفيذ» with an editable message).
  Copilot: products resource `kind` / `delivery_type` / `codes_left` (never codes), actions `products.add_codes` (codes
  encrypted in the change, counted in the preview) and `orders.deliver_service`. PHP upload limit raised to 110 MB
  (`back/docker/php.ini`). Tests: `tests/Feature/Store/DigitalProductsTest.php`, `tests/Feature/Store/CopilotDigitalTest.php`,
  `front/src/features/catalog/products/digital.test.tsx`.
