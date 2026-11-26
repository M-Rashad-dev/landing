<?php

declare(strict_types=1);

namespace App\Orders;

use App\Actions\Orders\ChangeOrderStatus;
use App\Enums\ConfirmState;
use App\Enums\MessagePurpose;
use App\Enums\OrderStatus;
use App\Messaging\WhatsApp\WhatsAppError;
use App\Messaging\WhatsApp\WhatsAppMessenger;
use App\Messaging\WhatsApp\WhatsAppTemplateStatus;
use App\Models\BlockedCustomer;
use App\Models\Order;
use App\Models\OrderConfirmationSetting;
use App\Models\OrderItem;
use App\Models\Tenant;
use App\Notifications\StoreNotices;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

/**
 * Order confirmation on WhatsApp (free, from the platform's number): a cash-on-delivery order gets «أكّد الطلب» /
 * «الغي الطلب» / «عايز أكلم حد»; the answer moves the order (confirmed / cancelled by the customer / for a call) and
 * the customer gets a short reply. One reminder, then «ماردّش» or a cancel, per the store's settings.
 */
final class WhatsAppConfirmations
{
    public const TEMPLATE = 'order_confirm';

    public const REMINDER = 'order_confirm_reminder';

    /** A text written while a confirmation is open (this many hours) goes to the call center. */
    public const OPEN_HOURS = 48;

    private const ACTIONS = ['confirm', 'cancel', 'call'];

    public function __construct(
        private readonly WhatsAppMessenger $messenger,
        private readonly WhatsAppTemplateStatus $templates,
        private readonly StoreNotices $notices,
    ) {}

    /** The store can use it: WhatsApp keys set and the template approved by Meta. */
    public function available(): bool
    {
        return $this->messenger->configured() && $this->templates->approvedUtility('order_confirm_v1');
    }

    /** This new order gets a confirmation instead of the «received» message (inside its tenant). */
    public function eligible(Order $order): bool
    {
        if ($order->status !== OrderStatus::New || $order->isPrepaid() || $order->confirm_state !== null || ! OrderConfirmationSetting::current()->enabled || ! $this->available()) {
            return false;
        }

        // Every cash-on-delivery order on its phone (no opt-in asked), except a blocked customer.
        return ! BlockedCustomer::isBlocked($order->customer_phone, $order->ip_address);
    }

    /** Sends the confirmation (or its reminder); false when it couldn't go (the order stays for a call). */
    public function send(Order $order, bool $reminder = false): bool
    {
        $store = (string) Tenant::query()->whereKey($order->tenant_id)->value('name');
        $total = $this->plain(Money::toCents((string) $order->total));
        $params = $reminder
            ? [(string) $order->order_number, $store, $total]
            : [(string) $order->order_number, $store, $total, $this->items($order)];
        $params = array_map(fn (string $p): string => trim((string) preg_replace('/\s+/u', ' ', $p)) ?: '—', $params);

        try {
            $this->messenger->sendTemplate($order->customer_phone, $reminder ? self::REMINDER : self::TEMPLATE, $params, null, $reminder ? MessagePurpose::OrderConfirmReminder : MessagePurpose::OrderConfirm, $order->tenant_id, $order->id, array_map(fn (string $a) => $this->payload($a, $order), self::ACTIONS));
        } catch (WhatsAppError) {
            $order->forceFill(['confirm_state' => ConfirmState::Failed->value])->save();

            return false;
        }
        $order->forceFill($reminder ? ['confirm_state' => ConfirmState::Reminded->value, 'confirm_reminded_at' => now()] : ['confirm_state' => ConfirmState::Sent->value, 'confirm_sent_at' => now()])->save();

        return true;
    }

    /**
     * A button press or a message from a phone. True when it was about an order confirmation (handled here), false
     * for anything else (the usual auto-reply then).
     */
    public function incoming(string $phone, ?string $payload, bool $isText): bool
    {
        if ($payload !== null && str_starts_with($payload, 'oc:')) {
            $this->answer($phone, $payload);

            return true;
        }
        if (! $isText) {
            return false;
        }
        // Audited bypass: the phone's newest open confirmation in any store (the phone wrote to the platform's number).
        $order = Tenancy::withoutTenant(fn () => Order::query()->where('customer_phone', $phone)
            ->whereIn('confirm_state', [ConfirmState::Sent->value, ConfirmState::Reminded->value])
            ->where('confirm_sent_at', '>=', now()->subHours(self::OPEN_HOURS))->latest('id')->first());
        if ($order === null) {
            return false;
        }
        Tenancy::runAs($order->tenant_id, function () use ($order): void {
            $order->forceFill(['confirm_state' => ConfirmState::NeedsCall->value, 'confirm_replied_at' => now()])->save();
            $this->notices->customerReply($order, ConfirmState::NeedsCall);
            $this->reply($order, 'call');
        });

        return true;
    }

    /** Reminders and timeouts (scheduled every 10 minutes). @return array{reminded: int, closed: int} */
    public function followUp(): array
    {
        // Audited bypass: the stores with open confirmations; each one then runs inside its own tenant.
        $tenants = Tenancy::withoutTenant(fn () => Order::query()->whereIn('confirm_state', [ConfirmState::Sent->value, ConfirmState::Reminded->value])->distinct()->pluck('tenant_id')->all());
        $reminded = $closed = 0;
        foreach ($tenants as $tenantId) {
            Tenancy::runAs((int) $tenantId, function () use (&$reminded, &$closed): void {
                $settings = OrderConfirmationSetting::current();
                $open = Order::query()->whereIn('confirm_state', [ConfirmState::Sent->value, ConfirmState::Reminded->value]);
                // Anything the merchant already moved is no longer waiting.
                (clone $open)->where('status', '!=', OrderStatus::New->value)->update(['confirm_state' => null]);

                (clone $open)->where('status', OrderStatus::New->value)->where('confirm_sent_at', '<', now()->subHours($settings->final_hours))->get()
                    ->each(function (Order $order) use ($settings, &$closed): void {
                        if ($settings->on_timeout === 'cancel') {
                            app(ChangeOrderStatus::class)->handle($order, OrderStatus::Cancelled, (string) __('confirmations.timeout_note'), null);
                        }
                        $order->forceFill(['confirm_state' => ConfirmState::NoReply->value])->save();
                        $closed++;
                    });

                if ($settings->reminder_hours !== null && $settings->reminder_hours < $settings->final_hours) {
                    (clone $open)->where('confirm_state', ConfirmState::Sent->value)->where('status', OrderStatus::New->value)
                        ->where('confirm_sent_at', '<', now()->subHours($settings->reminder_hours))->get()
                        ->each(function (Order $order) use (&$reminded): void {
                            if ($this->send($order, true)) {
                                $reminded++;
                            }
                        });
                }
            });
        }

        return ['reminded' => $reminded, 'closed' => $closed];
    }

    /** The last 30 days in numbers (the settings page). @return array<string, int> */
    public function stats(): array
    {
        $rows = Order::query()->whereNotNull('confirm_state')->where('created_at', '>=', now()->subDays(30))
            ->selectRaw('confirm_state, count(*) as n')->groupBy('confirm_state')->pluck('n', 'confirm_state');

        return array_combine(ConfirmState::values(), array_map(fn (string $s) => (int) ($rows[$s] ?? 0), ConfirmState::values()));
    }

    /** "oc:{action}:{order id}:{signature}" — the button's payload; only our signature is accepted back. */
    public function payload(string $action, Order $order): string
    {
        return 'oc:'.$action.':'.$order->id.':'.$this->signature($action, $order->id, $order->tenant_id);
    }

    private function answer(string $phone, string $payload): void
    {
        $parts = explode(':', $payload);
        if (count($parts) !== 4 || ! in_array($parts[1], self::ACTIONS, true) || ! ctype_digit($parts[2])) {
            return;
        }
        [, $action, $id, $signature] = $parts;
        // Audited bypass: the order named by a signed payload; checked against its own tenant and phone below.
        $order = Tenancy::withoutTenant(fn () => Order::query()->find((int) $id));
        if ($order === null || ! hash_equals($this->signature($action, $order->id, $order->tenant_id), $signature) || $order->customer_phone !== $phone) {
            return;
        }

        Tenancy::runAs($order->tenant_id, function () use ($order, $action): void {
            $order = DB::transaction(fn () => Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail());
            // The merchant (or an earlier press) already moved it: say where it is, change nothing.
            if ($order->status !== OrderStatus::New) {
                $this->reply($order, 'already');

                return;
            }
            $state = match ($action) {
                'confirm' => ConfirmState::Confirmed,
                'cancel' => ConfirmState::Cancelled,
                default => ConfirmState::NeedsCall,
            };
            $order->forceFill(['confirm_state' => $state->value, 'confirm_replied_at' => now()])->save();
            if ($state === ConfirmState::Confirmed) {
                app(ChangeOrderStatus::class)->handle($order, OrderStatus::Confirmed, (string) __('confirmations.confirmed_note'), null);
            } elseif ($state === ConfirmState::Cancelled) {
                app(ChangeOrderStatus::class)->handle($order, OrderStatus::Cancelled, (string) __('confirmations.cancelled_note'), null, ['notify' => false]);
                $this->notices->customerReply($order, $state);
            } else {
                $this->notices->customerReply($order, $state);
            }
            $this->reply($order->refresh(), $action);
        });
    }

    /** The free reply inside the window the customer just opened. */
    private function reply(Order $order, string $kind): void
    {
        $store = (string) Tenant::query()->whereKey($order->tenant_id)->value('name');
        $text = (string) __('confirmations.replies.'.$kind, ['number' => $order->order_number, 'store' => $store, 'status' => $order->status->label()]);
        try {
            $this->messenger->sendText($order->customer_phone, $text, MessagePurpose::OrderConfirmReply, $order->tenant_id, $order->id);
        } catch (WhatsAppError) {
            // The order already moved; a lost reply changes nothing.
        }
    }

    private function signature(string $action, int $orderId, int $tenantId): string
    {
        return substr(hash_hmac('sha256', 'oc|'.$action.'|'.$orderId.'|'.$tenantId, (string) config('app.key')), 0, 20);
    }

    private function items(Order $order): string
    {
        $order->loadMissing('items');
        $text = $order->items->map(fn (OrderItem $i) => $i->product_name.($i->quantity > 1 ? ' × '.$i->quantity : ''))->implode('، ');

        return mb_strlen($text) > 120 ? mb_substr($text, 0, 117).'…' : $text;
    }

    private function plain(int $cents): string
    {
        return number_format($cents / 100, $cents % 100 === 0 ? 0 : 2);
    }
}
