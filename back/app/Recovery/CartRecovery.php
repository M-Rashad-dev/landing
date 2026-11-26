<?php

declare(strict_types=1);

namespace App\Recovery;

use App\Enums\DiscountType;
use App\Enums\LeadStatus;
use App\Enums\MessagePurpose;
use App\Enums\PromotionTarget;
use App\Mail\CustomerOrderMail;
use App\Mail\Store\StoreMailer;
use App\Messaging\WhatsApp\WhatsAppError;
use App\Messaging\WhatsApp\WhatsAppMessenger;
use App\Messaging\WhatsApp\WhatsAppTemplateStatus;
use App\Models\AbandonedLead;
use App\Models\BlockedCustomer;
use App\Models\CartRecoverySetting;
use App\Models\DiscountCode;
use App\Models\LandingPage;
use App\Models\LeadReminder;
use App\Models\MessageWallet;
use App\Models\Order;
use App\Models\Product;
use App\Models\RecoveryOptOut;
use App\Models\Tenant;
use App\Notifications\StoreNotices;
use App\Services\PublicSite;
use App\Support\CairoTime;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Throwable;

/**
 * Abandoned cart reminders (docs/plans/merchant-essentials.md, stage 4). A store that turned them on gets up to two
 * reminders per abandoned lead: WhatsApp from the platform's number (one message from the store's balance each; no
 * consent asked, the owner's decision) and email when the address is known. They stop the moment the phone orders,
 * the merchant handles the lead, the customer is blocked or asked to stop, or the lead is 3 days old. Nothing goes
 * out between 11 pm and 9 am Cairo time (held for the morning). Each reminder carries a link that refills the cart.
 */
final class CartRecovery
{
    public const TEMPLATE = 'cart_reminder_v1';

    /** Leads older than this get nothing. */
    public const MAX_AGE_DAYS = 3;

    /** An order within this many days of a reminder counts as brought back by it. */
    public const RECOVERED_DAYS = 7;

    /** No sending from 23:00 to 09:00 Cairo. */
    public const QUIET_FROM = 23;

    public const QUIET_TO = 9;

    /** A generated coupon lasts this long. */
    public const COUPON_HOURS = 48;

    /** The merchant's own reminders («ابعت تذكير») reach leads up to this old. */
    public const MANUAL_MAX_DAYS = 14;

    /** One manual send at a time per store (seconds the lock lives at most). */
    public const MANUAL_LOCK_SECONDS = 600;

    public function __construct(
        private readonly WhatsAppMessenger $messenger,
        private readonly WhatsAppTemplateStatus $templates,
        private readonly MessageWallets $wallets,
        private readonly StoreMailer $mailer,
        private readonly StoreNotices $notices,
    ) {}

    /** WhatsApp is set up and Meta approved the reminder template. */
    public function whatsappAvailable(): bool
    {
        return $this->messenger->configured() && $this->templates->approved(self::TEMPLATE);
    }

    public static function quiet(?CarbonImmutable $at = null): bool
    {
        $hour = (int) ($at ?? CarbonImmutable::now())->setTimezone(CairoTime::ZONE)->format('G');

        return $hour >= self::QUIET_FROM || $hour < self::QUIET_TO;
    }

    /** Every store with reminders on (the scheduler). Returns the reminders sent. */
    public function run(): int
    {
        if (self::quiet()) {
            return 0;
        }
        // Audited bypass: the list of stores that turned reminders on; each is then handled inside its own tenant.
        $tenants = Tenancy::withoutTenant(fn () => CartRecoverySetting::query()->where('enabled', true)->pluck('tenant_id')->all());
        $sent = 0;
        foreach ($tenants as $tenantId) {
            try {
                $sent += Tenancy::runAs((int) $tenantId, fn (): int => $this->remindDue());
            } catch (Throwable $e) {
                report($e);
            }
        }

        return $sent;
    }

    /** The reminders due in the current store. */
    public function remindDue(): int
    {
        $settings = CartRecoverySetting::current();
        if (! $settings->enabled) {
            return 0;
        }
        $steps = $settings->second_hours === null ? 1 : 2;
        $sent = 0;
        AbandonedLead::query()
            ->where('status', LeadStatus::Open)->whereNotNull('customer_phone')
            ->where('created_at', '>=', now()->subDays(self::MAX_AGE_DAYS))
            ->where('reminders_sent', '<', $steps)
            ->orderBy('id')->limit(200)->get()
            ->each(function (AbandonedLead $lead) use ($settings, &$sent): void {
                if ($this->due($lead, $settings) && $this->remind($lead, $settings)) {
                    $sent++;
                }
            });

        return $sent;
    }

    public function due(AbandonedLead $lead, CartRecoverySetting $settings): bool
    {
        if ($lead->reminders_sent === 0) {
            return ($lead->last_seen_at ?? $lead->created_at)->copy()->addMinutes($settings->first_minutes)->lte(now());
        }

        return $settings->second_hours !== null && $lead->last_reminded_at !== null && $lead->last_reminded_at->copy()->addHours($settings->second_hours)->lte(now());
    }

    /** Why this lead gets no more reminders, or null. A manual one also reaches «اتواصلت» leads, up to 14 days old. */
    public function stopReason(AbandonedLead $lead, bool $manual = false): ?string
    {
        return match (true) {
            $lead->status !== LeadStatus::Open && ! ($manual && $lead->status === LeadStatus::Contacted) => 'handled',
            // A prepaid order waiting for its money: the pay page follows it, not a cart reminder.
            $lead->order_id !== null => 'waiting_payment',
            $lead->created_at->lt(now()->subDays($manual ? self::MANUAL_MAX_DAYS : self::MAX_AGE_DAYS)) => 'old',
            BlockedCustomer::isBlocked((string) $lead->customer_phone, $lead->ip_address) => 'blocked',
            RecoveryOptOut::blocks($lead->customer_phone, $lead->customer_email) => 'opted_out',
            Order::query()->where('customer_phone', $lead->customer_phone)->where('created_at', '>=', $lead->created_at)->exists() => 'ordered',
            default => null,
        };
    }

    /** Sends the lead's next reminder on every channel it can; false when nothing could go. */
    public function remind(AbandonedLead $lead, CartRecoverySetting $settings): bool
    {
        return $this->locked($lead, function (AbandonedLead $lead) use ($settings): bool {
            // Sent by hand meanwhile: the step it was due for is gone.
            if ($this->stopReason($lead) !== null || ! $this->due($lead, $settings)) {
                return false;
            }
            $step = $lead->reminders_sent + 1;
            $coupon = $step === 2 ? $this->coupon($lead, $settings) : null;

            return $this->deliver($lead, $step, $coupon, $settings->whatsapp, $settings->email);
        });
    }

    /**
     * The merchant's reminder, now (any hour, no coupon). It counts as the lead's next step: by hand before the first
     * one, the automatic one that follows is the second; by hand after the first, the automatic second never goes;
     * after both, as many as the merchant wants. False when it couldn't go (stopped, or no channel worked).
     */
    public function remindNow(AbandonedLead $lead): bool
    {
        return $this->locked($lead, fn (AbandonedLead $lead): bool => $this->stopReason($lead, true) === null
            && $this->deliver($lead, $lead->reminders_sent + 1, null, true, true));
    }

    /**
     * The leads a manual reminder can go to: open or contacted, with a phone, not waiting on an order's payment, up
     * to 14 days old ($ids = null: all of them; $source: landing / store / cart only).
     *
     * @param  list<int>|null  $ids
     * @return Builder<AbandonedLead>
     */
    public function manualTargets(?array $ids = null, ?string $source = null): Builder
    {
        return AbandonedLead::query()
            ->whereIn('status', [LeadStatus::Open, LeadStatus::Contacted])
            ->whereNotNull('customer_phone')->whereNull('order_id')
            ->where('created_at', '>=', now()->subDays(self::MANUAL_MAX_DAYS))
            ->when($ids !== null, fn (Builder $q) => $q->whereKey($ids))
            ->when($source !== null, fn (Builder $q) => $q->where('source', $source));
    }

    /** @param array{code: string, discount: string, until: string}|null $coupon */
    private function deliver(AbandonedLead $lead, int $step, ?array $coupon, bool $whatsapp, bool $email): bool
    {
        $sent = false;
        if ($whatsapp && $lead->customer_phone && $this->whatsappAvailable()) {
            $sent = $this->whatsapp($lead, $step, $coupon) || $sent;
        }
        if ($email && $lead->customer_email) {
            $sent = $this->email($lead, $step, $coupon) || $sent;
        }
        if ($sent) {
            $lead->forceFill(['reminders_sent' => $step, 'last_reminded_at' => now()])->save();
        }

        return $sent;
    }

    /**
     * One reminder per lead at a time (the scheduler and a manual send can meet): runs on a fresh copy of the lead.
     *
     * @param  callable(AbandonedLead): bool  $send
     */
    private function locked(AbandonedLead $lead, callable $send): bool
    {
        $lock = Cache::lock('cart-reminder:'.$lead->id, 60);
        if (! $lock->get()) {
            return false;
        }
        try {
            $fresh = AbandonedLead::query()->find($lead->id);

            return $fresh !== null && $send($fresh);
        } finally {
            $lock->release();
        }
    }

    /** @param array{code: string, discount: string, until: string}|null $coupon */
    private function whatsapp(AbandonedLead $lead, int $step, ?array $coupon): bool
    {
        if (! $this->wallets->charge(__('recovery.charge', ['lead' => $lead->id]))) {
            $this->balanceEmpty($lead->tenant_id);

            return false;
        }
        $params = [$this->firstName($lead), $this->storeName($lead->tenant_id), $this->items($lead)];
        if ($coupon !== null) {
            array_push($params, $coupon['code'], $coupon['discount'], $coupon['until']);
        }
        $params = array_map(fn (string $p): string => trim((string) preg_replace('/\s+/u', ' ', $p)) ?: '—', $params);

        try {
            $message = $this->messenger->sendTemplate(
                (string) $lead->customer_phone,
                $coupon === null ? 'cart_reminder' : 'cart_reminder_coupon',
                $params,
                $this->token($lead),
                MessagePurpose::CartReminder,
                $lead->tenant_id,
                null,
                [$this->payload($lead)],
            );
        } catch (WhatsAppError) {
            $this->wallets->credit($lead->tenant_id, 1, 'refund', __('recovery.refund', ['lead' => $lead->id]));

            return false;
        }
        LeadReminder::query()->create(['abandoned_lead_id' => $lead->id, 'step' => $step, 'channel' => 'whatsapp', 'outbound_message_id' => $message->id, 'charged' => true, 'coupon_code' => $coupon['code'] ?? null]);

        return true;
    }

    /** @param array{code: string, discount: string, until: string}|null $coupon */
    private function email(AbandonedLead $lead, int $step, ?array $coupon): bool
    {
        $store = $this->storeName($lead->tenant_id);
        $rows = array_map(fn (array $i): array => ['label' => (string) $i['name'], 'value' => '× '.(int) $i['quantity']], $this->lines($lead));
        if ($coupon !== null) {
            $rows[] = ['label' => __('recovery.email.code'), 'value' => $coupon['code'].' ('.$coupon['discount'].')'];
        }
        try {
            $via = $this->mailer->send($lead->tenant_id, (string) $lead->customer_email, new CustomerOrderMail(
                'cart_reminder',
                $store,
                __($coupon === null ? 'recovery.email.subject' : 'recovery.email.subject_coupon', ['store' => $store]),
                __($coupon === null ? 'recovery.email.intro' : 'recovery.email.intro_coupon', ['name' => $this->firstName($lead), 'store' => $store, 'until' => $coupon['until'] ?? '']),
                $rows,
                __('recovery.email.action'),
                $this->restoreUrl($lead),
                __('recovery.email.footer', ['store' => $store, 'url' => $this->unsubscribeUrl($lead)]),
            ));
            $message = $this->messenger->logEmail((string) $lead->customer_email, MessagePurpose::CartReminder, $lead->tenant_id, null, $via->value);
        } catch (Throwable $e) {
            report($e);

            return false;
        }
        LeadReminder::query()->create(['abandoned_lead_id' => $lead->id, 'step' => $step, 'channel' => 'email', 'outbound_message_id' => $message->id, 'charged' => false, 'coupon_code' => $coupon['code'] ?? null]);

        return true;
    }

    /**
     * The second reminder's coupon: the merchant's code, or a one-time code made for this lead (48 h).
     *
     * @return array{code: string, discount: string, until: string}|null
     */
    private function coupon(AbandonedLead $lead, CartRecoverySetting $settings): ?array
    {
        if ($settings->coupon_mode === CartRecoverySetting::COUPON_CODE && $settings->discount_code_id !== null) {
            $code = DiscountCode::query()->whereKey($settings->discount_code_id)->where('is_active', true)->first();
            if ($code === null || ($code->ends_at !== null && $code->ends_at->isPast())) {
                return null;
            }

            return ['code' => $code->code, 'discount' => $this->discountLabel($code->type, (string) $code->value), 'until' => $code->ends_at === null ? __('recovery.no_end') : $this->day($code->ends_at->toImmutable())];
        }
        if ($settings->coupon_mode !== CartRecoverySetting::COUPON_GENERATED || $settings->coupon_value === null) {
            return null;
        }
        $type = $settings->coupon_type === 'fixed' ? DiscountType::Fixed : DiscountType::Percentage;
        $ends = CarbonImmutable::now()->addHours(self::COUPON_HOURS);
        $code = DiscountCode::query()->create([
            'code' => 'BACK'.strtoupper(Str::random(6)),
            'type' => $type,
            'applies_to' => PromotionTarget::All,
            'value' => (string) $settings->coupon_value,
            'starts_at' => now(),
            'ends_at' => $ends,
            'usage_limit' => 1,
            'usage_limit_per_phone' => 1,
            'first_order_only' => false,
            'stackable_with_offers' => true,
            'is_active' => true,
            'recovery' => true,
        ]);

        return ['code' => $code->code, 'discount' => $this->discountLabel($type, (string) $settings->coupon_value), 'until' => $this->day($ends)];
    }

    private function discountLabel(DiscountType $type, string $value): string
    {
        $number = rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.');

        return match ($type) {
            DiscountType::Percentage => $number.'%',
            DiscountType::Fixed => $number.' '.__('recovery.pound'),
            DiscountType::FreeShipping => __('recovery.free_shipping'),
        };
    }

    private function day(CarbonImmutable $at): string
    {
        return $at->setTimezone(CairoTime::ZONE)->locale('ar')->translatedFormat('j F h:i A');
    }

    /** The lead's link token (the same in both reminders; stored hashed). */
    public function token(AbandonedLead $lead): string
    {
        $token = substr(hash_hmac('sha256', 'cr|'.$lead->id.'|'.$lead->tenant_id, (string) config('app.key')), 0, 24);
        if ($lead->recovery_token !== hash('sha256', $token)) {
            $lead->forceFill(['recovery_token' => hash('sha256', $token)])->save();
        }

        return $token;
    }

    /** The «مش مهتم» button's signed payload. */
    public function payload(AbandonedLead $lead): string
    {
        return 'cr:stop:'.$lead->id.':'.substr(hash_hmac('sha256', 'cr-stop|'.$lead->id.'|'.$lead->tenant_id, (string) config('app.key')), 0, 20);
    }

    /** The link in the reminders: the platform's short link, sent on to the store (Meta needs one fixed domain). */
    public function shortUrl(AbandonedLead $lead): string
    {
        return rtrim(PublicSite::url((string) config('landing.platform_domain')), '/').'/r/'.$this->token($lead);
    }

    /** Where the link lands: the store's checkout refilled, or the landing page's form; null when the store has no site. */
    public function restoreUrl(AbandonedLead $lead): ?string
    {
        $host = app(PublicSite::class)->primaryHost($lead->tenant_id);
        if ($host === null) {
            return null;
        }
        $token = $this->token($lead);
        if ($lead->landing_page_id !== null) {
            $slug = LandingPage::query()->whereKey($lead->landing_page_id)->value('slug');

            return rtrim(PublicSite::url($host, (string) $slug), '/').'?r='.$token;
        }

        return rtrim(PublicSite::url($host), '/').'/checkout?r='.$token;
    }

    public function unsubscribeUrl(AbandonedLead $lead): string
    {
        return rtrim(PublicSite::url((string) config('landing.platform_domain')), '/').'/u/'.$this->token($lead);
    }

    /** A link's lead, any store (the visitor's link carries no store). */
    public static function find(string $token): ?AbandonedLead
    {
        if (preg_match('/^[a-f0-9]{24}$/', $token) !== 1) {
            return null;
        }

        // Audited bypass: the restore / unsubscribe link names its lead by a hashed token (no store in it).
        return Tenancy::withoutTenant(fn () => AbandonedLead::query()->where('recovery_token', hash('sha256', $token))->first());
    }

    /**
     * What the restore link refills: the cart's lines still on sale (product, options, quantity, and what the cart
     * shows: name, image, price, the options' names) and the customer's details. Lines that left the store are dropped.
     *
     * @return array{kind: string, items: list<array<string, mixed>>, customer: array{name: string|null, phone: string|null, email: string|null}, quantity: int}
     */
    public function restore(AbandonedLead $lead): array
    {
        return Tenancy::runAs($lead->tenant_id, function () use ($lead): array {
            $lines = array_values(array_filter($this->lines($lead), fn (array $i) => isset($i['product_id'])));
            $products = Product::query()->whereIn('id', array_column($lines, 'product_id'))->where('is_active', true)->with(['media', 'options.values'])->get()->keyBy('id');
            $items = [];
            foreach ($lines as $line) {
                $product = $products->get((int) $line['product_id']);
                if (! $product instanceof Product) {
                    continue;
                }
                $options = array_map('intval', (array) ($line['options'] ?? []));
                $labels = [];
                $delta = 0;
                foreach ($product->options as $option) {
                    $value = $option->values->firstWhere('id', $options[(string) $option->id] ?? null);
                    if ($value !== null) {
                        $labels[] = $option->name.': '.$value->label;
                        $delta += Money::toCents((string) $value->price_delta);
                    }
                }
                $image = $product->media->first();
                $items[] = [
                    'product_id' => $product->id,
                    'quantity' => max(1, (int) $line['quantity']),
                    'options' => $options,
                    'name' => $product->name,
                    'slug' => (string) $product->slug,
                    'image' => $image === null ? null : ($image->urls()['thumb'] ?? null),
                    'price' => Money::toFloat($product->priceCents() + $delta),
                    'options_label' => implode('، ', $labels),
                    'digital' => $product->isDigital(),
                ];
            }

            return [
                'kind' => $lead->landing_page_id !== null ? 'landing' : 'store',
                'items' => $items,
                'customer' => ['name' => $lead->customer_name, 'phone' => $lead->customer_phone, 'email' => $lead->customer_email],
                'quantity' => $lead->quantity,
            ];
        });
    }

    /** The customer asked to stop (the WhatsApp button or the email link): no more reminders from this store. */
    public function optOut(AbandonedLead $lead, bool $reply): void
    {
        Tenancy::runAs($lead->tenant_id, function () use ($lead, $reply): void {
            if (! RecoveryOptOut::blocks($lead->customer_phone, $lead->customer_email)) {
                RecoveryOptOut::query()->create(['phone' => $lead->customer_phone, 'email' => $lead->customer_email ? mb_strtolower($lead->customer_email) : null]);
            }
            if ($reply && $lead->customer_phone) {
                try {
                    $this->messenger->sendText((string) $lead->customer_phone, (string) __('recovery.stopped_reply', ['store' => $this->storeName($lead->tenant_id)]), MessagePurpose::CartReminderReply, $lead->tenant_id);
                } catch (WhatsAppError) {
                    // The stop is recorded; the courtesy reply is not essential.
                }
            }
        });
    }

    /** A «مش مهتم» press from WhatsApp; true when the payload was ours. */
    public function incoming(string $phone, ?string $payload): bool
    {
        if ($payload === null || ! str_starts_with($payload, 'cr:stop:')) {
            return false;
        }
        $parts = explode(':', $payload);
        $id = (int) ($parts[2] ?? 0);
        // Audited bypass: the button names its lead; the signature and the phone are checked below.
        $lead = Tenancy::withoutTenant(fn () => AbandonedLead::query()->find($id));
        if ($lead !== null && hash_equals($this->payload($lead), $payload) && $lead->customer_phone === $phone) {
            $this->optOut($lead, true);
        }

        return true;
    }

    /** WhatsApp said a reminder never arrived: its message goes back to the balance. */
    public function failed(int $outboundMessageId): void
    {
        // Audited bypass: the platform message this status is about, then its store's reminder row.
        $reminder = Tenancy::withoutTenant(fn () => LeadReminder::query()->where('outbound_message_id', $outboundMessageId)->where('charged', true)->first());
        if ($reminder === null) {
            return;
        }
        Tenancy::runAs($reminder->tenant_id, fn () => $reminder->forceFill(['charged' => false])->save());
        $this->wallets->credit($reminder->tenant_id, 1, 'refund', __('recovery.refund', ['lead' => $reminder->abandoned_lead_id]));
    }

    /** Leads this order closes: those reminded in the last 7 days count as brought back (inside the tenant). */
    public static function recovered(Order $order, ?string $cartToken = null): void
    {
        AbandonedLead::query()
            ->where(fn ($q) => $q->where('customer_phone', $order->customer_phone)->when($cartToken !== null, fn ($w) => $w->orWhere('cart_token', $cartToken)))
            ->whereIn('status', [LeadStatus::Open, LeadStatus::Contacted])
            ->where('reminders_sent', '>', 0)->where('last_reminded_at', '>=', now()->subDays(self::RECOVERED_DAYS))
            ->update(['recovered_at' => now()]);
    }

    /**
     * The last N days: reminders sent per channel, leads brought back and their orders' total.
     *
     * @return array{reminders: int, whatsapp: int, email: int, recovered: int, revenue: float}
     */
    public function stats(int $days = 30): array
    {
        $since = now()->subDays($days);
        $channels = LeadReminder::query()->where('created_at', '>=', $since)->selectRaw('channel, count(*) as n')->groupBy('channel')->pluck('n', 'channel');
        $recovered = AbandonedLead::query()->whereNotNull('recovered_at')->where('recovered_at', '>=', $since);
        $orderIds = (clone $recovered)->whereNotNull('order_id')->pluck('order_id');

        return [
            'reminders' => (int) $channels->sum(),
            'whatsapp' => (int) ($channels['whatsapp'] ?? 0),
            'email' => (int) ($channels['email'] ?? 0),
            'recovered' => (clone $recovered)->count(),
            'revenue' => Money::toFloat(Money::toCents((string) (Order::query()->whereIn('id', $orderIds)->sum('total') ?: '0'))),
        ];
    }

    /** Told once (until the next top-up) that reminders stopped for lack of messages. */
    private function balanceEmpty(int $tenantId): void
    {
        $wallet = MessageWallet::query()->first();
        if ($wallet !== null && $wallet->empty_notified_at !== null) {
            return;
        }
        $wallet ??= MessageWallet::query()->create(['balance' => 0]);
        $wallet->forceFill(['empty_notified_at' => now()])->save();
        $this->notices->recoveryBalanceEmpty($tenantId);
    }

    /** @return list<array{product_id?: int, name: string, quantity: int, options?: array<string, int>}> */
    private function lines(AbandonedLead $lead): array
    {
        $items = (array) ($lead->cart['items'] ?? []);
        if ($items !== []) {
            return array_values($items);
        }
        $name = $lead->product_id === null ? null : $lead->product()->value('name');

        return $name === null ? [] : [['product_id' => (int) $lead->product_id, 'name' => (string) $name, 'quantity' => $lead->quantity]];
    }

    /** «تيشيرت × 2، كاب» (three at most, then «و 2 كمان»). */
    private function items(AbandonedLead $lead): string
    {
        $lines = $this->lines($lead);
        $names = array_map(fn (array $i): string => $i['name'].((int) $i['quantity'] > 1 ? ' × '.(int) $i['quantity'] : ''), array_slice($lines, 0, 3));
        $text = implode('، ', $names) ?: (string) __('recovery.your_cart');
        if (count($lines) > 3) {
            $text .= ' '.__('recovery.and_more', ['n' => count($lines) - 3]);
        }

        return mb_substr($text, 0, 200);
    }

    private function firstName(AbandonedLead $lead): string
    {
        $name = trim((string) $lead->customer_name);

        return $name === '' ? (string) __('recovery.friend') : (string) Str::of($name)->explode(' ')->first();
    }

    private function storeName(int $tenantId): string
    {
        return (string) Tenant::query()->whereKey($tenantId)->value('name');
    }
}
