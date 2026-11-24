# HANDOFF — read this first, then continue the work

You are taking over from another Claude session on this project with no break in between. The owner
(Mohamed Rashad) expects you to act exactly like the previous session: same rules, same style, no
re-explaining. Read, in this order:

1. `CLAUDE.md` (root) — layout, non-negotiables, commands.
2. `docs/PROJECT.md` — the whole project, conventions, roadmap, the copilot checklist («AI»).
3. `docs/plans/merchant-essentials.md` — **the plan being executed now** (stages + PROGRESS LOG at the end).
4. `DECISIONS.md` — the small decisions already taken (newest at the bottom).
5. This file — where we stopped, how the owner works, and the traps of this machine.

Optional, only when touching them: `docs/plans/ai-copilot.md`, `docs/plans/ai-designer.md`,
`docs/plans/digital-products.md`, `deploy/DEPLOY.md`, `PLAN.MD`, `PROGRESS.md`.

---

## 1. Where we are now (2026-11-24)

Plan `docs/plans/merchant-essentials.md`. The owner chose features **1, 2, 3, 5, 7** = five stages:

| Stage | What | State |
|---|---|---|
| 1 | Staff accounts + permissions (spatie, per page and action) | done — commit `4b19206a` |
| 2 | WhatsApp order confirmation (free, buttons) | done — `231bd338` |
| 3 | Cost and profit («الأرباح») | done — `fc53d46a` |
| 4 | Abandoned cart recovery (WhatsApp + email reminders, message packs) | done — `9b2228e7` |
| 5 | Refunds («المرتجعات والمبالغ المسترجعة») | done — see the plan's PROGRESS LOG |

**State: all five stages are finished, committed and pushed (v4 + main). Stage 5 (refunds) is waiting for
the owner's review. The merchant-essentials plan is complete.**

**What to do:** fix the owner's notes on Stage 5 first (if any), then ask him what's next (docs/PROJECT.md
roadmap). Don't start anything new without his choice.

---

## 2. How the owner works (hard rules)

- **Reply in Egyptian Arabic**, short and clear. Code, comments and docs in English (Arabic UI strings).
- **One stage at a time, then STOP** for his review. A stage ends with: tests green → docs updated
  (plan PROGRESS LOG entry + DECISIONS.md for decisions you took) → commit → push → a short Arabic report:
  what was built, how it works, decisions you took on your own, anything he must do (e.g. push WhatsApp
  templates for Meta review), and «مستني مراجعتك قبل ما أبدأ المرحلة X».
- **Short progress lines** in Arabic while working long (after each piece / every 30–60 min): where you
  are and what's next.
- **Always push** every commit at once: `git push origin v4` then `git push origin v4:main`. Never
  force-push. Branch is `v4`.
- **git add explicit paths only.** Never commit these untracked files: `docs/plans/Ai Copilot
  Implementation Plan.md`, `front/AGENTS.md`, `mksab-video-assets-brief.md`, and `v1/` (git-ignored).
  Never commit secrets (mail password, tokens) — the owner sets them in the server `.env` himself.
- **Never touch the production server** (VPS `/var/www/landing`, host vmi3729522): no SSH, no deploy, no
  commands — unless he explicitly asks in that very message. Default: tell him the commands
  (`./deploy/backup.sh && git pull && ./deploy/deploy.sh`). After a deploy he asked for, ask before checking.
- **System first:** extensible code, one registry/contract per concept, no scattered if-conditions; a
  change must never break other parts. The platform grows like Salla / Zid.
- **No legacy compatibility:** edit/rename/delete code in place; no parallel endpoints.
- **Eloquent / query builder**, not raw SQL. Performance and security matter.
- **Build UI directly** in the existing design system — no mockup images first.
- **Tests:** every new feature gets Feature tests (success, validation, 401, tenant isolation) and front
  tests. Small text/link changes: quick checks only, no long verification. Heavy code (money, tenancy,
  AI): thorough.
- **Don't save the owner's demo data in browser checks** (demo@example.com store); use your own data.
  Keep the «بيت القهوة» video tenant untouched.
- **External services** only with his approval, behind our own interface, keys in `.env`, a fake for
  tests, logged in DECISIONS.md.
- **WhatsApp goes from the platform's number only** (owner: build nothing for stores sending from their
  own number). Paid messages = only cart reminders (message packs); everything else is free.

---

## 3. Stage checklist (the pattern every stage followed)

Back (`back/`, Laravel 13, PHP 8.3):
1. Migration `database/migrations/2026_12_1X_100001_create_….php` (next free date after `2026_12_12`).
   Tenant tables: `tenant_id` + `BelongsToTenant`. Money `decimal(12,2)`.
2. Models (`@property` docblocks, casts), a service class (e.g. `app/Recovery/…`, `app/Analytics/…`).
3. FormRequest (`TenantExists` / `TenantUnique`, never plain `exists:`/`unique:` on tenant tables),
   thin controller, routes in `routes/api.php` (dashboard group).
4. **Permissions:** add actions to `app/Auth/PermissionCatalog.php` (`PAGES`), map **every new dashboard
   route** in `config/permissions.php` «routes» (a test fails on any unmapped route), run
   `php artisan permissions:sync`.
5. **Copilot:** one file per capability in `app/Ai/Copilot/Resources|Reports|Actions` (auto-discovered) +
   its entry in `config/permissions.php` «copilot» (`[read, create, update]`). Personal data fields
   `->hidden()`.
6. Arabic strings in `lang/ar/*.php`. Notifications: case in `app/Enums/NotificationEvent.php` (+ its
   `permission()`), method in `app/Notifications/StoreNotices.php`, text in `lang/ar/notifications.php`,
   icon in `front/src/features/notifications/bell.tsx`.
7. Tests in `tests/Feature/<Area>/…Test.php`.

Front (`front/`, Next 16): every Arabic string in `src/messages/ar/*.ts` (registered in
`src/messages/ar.ts`); RTL logical classes; react-hook-form + zod; 4 states (skeleton / empty / error /
toast); staff gating with `useCan()("page.action")`; new pages → `src/config/navigation.ts` +
`src/lib/auth/permissions.ts` PAGES (+ update `components/components.test.tsx` hrefs list).

Gates before committing:
- back: `source tools/env.sh` then `vendor/bin/pint -q`, `composer lint`, `php artisan test --parallel`
- front: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

---

## 4. Traps of this machine (learned the hard way)

- Windows + Git Bash. **Backslashes get mangled** in sed / heredocs / inline python (PHP namespaces
  `App\Models\X` lose their `\`). Write files with the Write/Edit tools, or write a Python script to the
  scratchpad with the Write tool (use `chr(92)` or a `§` placeholder for `\`) and run it. Open files with
  `newline=''` / `"\n"` (CRLF breaks Pint). Very long single bash commands with many heredocs fail with
  «unexpected EOF» — split them.
- `source tools/env.sh` first (portable PHP 8.3). MySQL = XAMPP MariaDB root/no password, DBs `landing`
  and `landing_test` (tests migrate themselves).
- **Migrations:** run once and check. If you change a migration that already ran locally, a rollback can
  fail halfway (its `down()` drops something that doesn't exist yet); then clean the leftover tables by
  hand and delete its row from `migrations`, then migrate again.
- Pest prints a JSON summary line; parse it (`tail -1`).
- Known flake: `tests/Feature/Ai/Copilot/CopilotReadTest.php` (Excel export) sometimes fails only in
  parallel runs — passes alone; not a real failure.
- If `npx vitest run <path>` says «Vitest failed to find the runner», use `pnpm test` instead.
- Pest helper functions are global across files: give new test helpers unique prefixes (e.g. `crLead`,
  `profitOrder`) and don't rely on helpers defined in another test file (running one file alone breaks).
- The local `.env` has a real WhatsApp token: tests and seed scripts must fake Http/Mail/Notification.
- Tests that need WhatsApp templates approved: put them in cache key `whatsapp:template-status`
  (`['name' => ['status' => 'APPROVED', 'category' => 'UTILITY'|'MARKETING']]`, TTL a year).
- Meta rule (tested): a template body must not start or end with a `{{n}}` variable.

---

## 5. Useful facts from the built stages (so you don't re-read everything)

- Staff: `App\Auth\PermissionCatalog::allows($user, 'key')` (owner passes everything);
  `EnforceStaffPermissions` middleware (`staff.can`) also writes the activity log.
- WhatsApp: `App\Messaging\WhatsApp\WhatsAppTemplates` (templates + optional `category => 'MARKETING'`,
  one BUTTONS block: URL first, then quick replies), `WhatsAppMessenger::sendTemplate/sendText/logEmail`,
  webhook `WhatsAppWebhook` (incoming button payloads → `CartRecovery::incoming`, then
  `WhatsAppConfirmations::incoming`; failed statuses). New templates must be pushed by the owner from
  admin «الرسائل» for Meta review.
- Store customer emails: `App\Mail\Store\StoreMailer::send($tenantId, $to, new CustomerOrderMail(...))`.
- Billing invoices types: `subscription`, `theme`, `ai_credit`, `message_pack`
  (`App\Billing\Payments\Invoices` + `Checkout` + `CheckoutRequest`; pay page `?messages=N`).
- Profit: `App\Analytics\OrderCosts` (snapshot on order creation; `profit(order)`) and
  `App\Analytics\ProfitReport` (dashboard `GET /dashboard/profit` + copilot `profit_summary`).
  Refunds (stage 5) already come off both.
- Refunds: `App\Orders\Refunds` (collected / refundable / request / complete / cancel, views for the screens,
  the customer and the webhook); `Stock::restockItems`; delivery status `revoked`.
- Order status changes: `App\Actions\Orders\ChangeOrderStatus`; prepaid payments:
  `App\Store\Payments\StorePayments`, `OrderPayment`; digital deliveries: `App\Store\Digital\DigitalDeliveries`;
  stock: `App\Store\Stock`; webhooks out: `App\Services\Webhooks\WebhookDispatcher` (+ payloads).
- Cart recovery: `App\Recovery\CartRecovery`, `MessageWallets`; command `leads:remind` (every 5 min).
