<?php

declare(strict_types=1);

namespace App\Store\Payments;

use App\Actions\Orders\ChangeOrderStatus;
use App\Enums\OrderPaymentState;
use App\Enums\OrderStatus;
use App\Enums\StorePaymentKind;
use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\StoreGatewayAccount;
use App\Models\StoreOnlinePayment;
use App\Models\StorePaymentMethod;
use App\Models\Tenant;
use App\Services\PublicSite;
use App\Store\Payments\Gateways\GatewayCheckout;
use App\Store\Payments\Gateways\GatewayError;
use App\Store\Payments\Gateways\GatewayRefund;
use App\Store\Payments\Gateways\GatewayResult;
use App\Store\Payments\Gateways\StoreGateways;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Online payment in the stores with the merchant's own gateway account (Paymob, Kashier, XPay): connecting it (the
 * credentials checked at the gateway and kept encrypted, an «ادفع أونلاين» method made for checkout), opening a hosted
 * checkout for a prepaid order, and settling it from what the gateway says (the customer's return and the gateway's
 * signed webhook only trigger that): paid with the order total → the order is paid and confirmed (its deliveries and
 * shipping follow), once. The money goes to the merchant's account; the platform never holds it.
 */
final class OnlineStorePayments
{
    public function __construct(
        private readonly StoreGateways $gateways,
        private readonly ChangeOrderStatus $status,
        private readonly StorePayments $payments,
    ) {}

    /** The gateways for «الإعدادات ← الدفع» (inside the store's tenant). @return list<array<string, mixed>> */
    public function overview(): array
    {
        $accounts = StoreGatewayAccount::query()->get()->keyBy('gateway');
        $methods = StorePaymentMethod::query()->where('kind', StorePaymentKind::Online)->get()->keyBy('gateway');

        return array_map(function (string $key) use ($accounts, $methods): array {
            $gateway = $this->gateways->get($key);
            $account = $accounts->get($key);

            return [
                'key' => $key,
                'label' => $gateway->label(),
                'fields' => array_map(fn (array $f) => $f + [
                    'label' => (string) __('payments.gateways.'.$key.'.fields.'.$f['key'].'.label'),
                    'hint' => (string) __('payments.gateways.'.$key.'.fields.'.$f['key'].'.hint'),
                ], $gateway->credentialFields()),
                'connected' => $account !== null,
                'mode' => $account?->mode,
                'status' => $account?->status,
                'connected_at' => $account?->connected_at?->toIso8601ZuluString(),
                'method_id' => $methods->get($key)?->id,
            ];
        }, $this->gateways->keys());
    }

    /**
     * Connects (or reconnects with new keys) a gateway: checked at the gateway, kept encrypted, and an active «ادفع
     * أونلاين» method. Wrong credentials → 422 on credentials.
     *
     * @param  array<string, mixed>  $input
     */
    public function connect(string $key, array $input): StoreGatewayAccount
    {
        $gateway = $this->gateways->get($key);
        $credentials = [];
        foreach ($gateway->credentialFields() as $field) {
            $value = is_string($input[$field['key']] ?? null) ? trim((string) $input[$field['key']]) : '';
            if ($value === '' || mb_strlen($value) > 500) {
                throw ValidationException::withMessages(['credentials.'.$field['key'] => [__('validation.required', ['attribute' => __('payments.gateways.'.$key.'.fields.'.$field['key'].'.label')])]]);
            }
            $credentials[$field['key']] = $value;
        }

        $account = StoreGatewayAccount::query()->firstOrNew(['gateway' => $key]);
        $token = $account->webhook_token ?: Str::lower(Str::random(40));
        try {
            $connection = $gateway->connect($credentials, $this->webhookUrl($key, $token));
        } catch (GatewayError $e) {
            Log::info('store_gateway.connect_failed', ['gateway' => $key, 'detail' => $e->detail]);

            throw ValidationException::withMessages(['credentials' => [$e->getMessage()]]);
        }
        if ($account->exists) {
            $gateway->disconnect($account);
        }

        return DB::transaction(function () use ($account, $connection, $token, $key, $gateway): StoreGatewayAccount {
            $account->fill([
                'gateway' => $key, 'credentials' => $connection->credentials, 'mode' => $connection->mode,
                'status' => StoreGatewayAccount::ACTIVE, 'webhook_token' => $token, 'last_error' => null, 'connected_at' => now(),
            ])->save();
            $method = StorePaymentMethod::query()->firstOrNew(['kind' => StorePaymentKind::Online, 'gateway' => $key]);
            if (! $method->exists) {
                $method->fill([
                    'name' => (string) __('payments.gateways.method_name'),
                    'instructions' => (string) __('payments.gateways.method_hint', ['gateway' => $gateway->label()]),
                    // First at checkout (hand-made methods start at 1).
                    'position' => 0,
                ]);
            }
            $method->fill(['is_active' => true])->save();

            return $account;
        });
    }

    /** Disconnects a gateway: its method stops showing; orders still waiting to pay with it block it. */
    public function disconnect(string $key): void
    {
        $gateway = $this->gateways->get($key);
        $account = StoreGatewayAccount::query()->where('gateway', $key)->first() ?? throw new ApiException(404, 'not_found', __('landing.not_found'));
        $method = StorePaymentMethod::query()->where('kind', StorePaymentKind::Online)->where('gateway', $key)->first();
        if ($method !== null && Order::query()->where('store_payment_method_id', $method->id)->where('status', OrderStatus::AwaitingPayment)->exists()) {
            throw new ApiException(422, 'method_used', __('payments.gateways.in_use'));
        }
        $gateway->disconnect($account);
        DB::transaction(function () use ($account, $method): void {
            $method?->forceFill(['is_active' => false])->save();
            $account->delete();
        });
    }

    /** The gateway behind an online method can take payments now (inside the store's tenant). */
    public function ready(StorePaymentMethod $method): bool
    {
        return $this->payments->usableMethods()->contains('id', $method->id);
    }

    /**
     * «ادفع أونلاين» on the pay page: a hosted checkout for the order total; returns where to send the customer. The pay
     * page may switch to another online method of the store (the order then shows it).
     */
    public function begin(Order $order, ?int $methodId = null): string
    {
        $method = StorePaymentMethod::query()->find($methodId ?? $order->store_payment_method_id);
        if ($order->status !== OrderStatus::AwaitingPayment || $method === null || $method->kind !== StorePaymentKind::Online || ! $method->is_active || ! $this->ready($method)) {
            throw new ApiException(409, 'not_awaiting_payment', __('payments.not_awaiting'));
        }
        if ($order->store_payment_method_id !== $method->id) {
            $order->forceFill(['store_payment_method_id' => $method->id, 'payment_method_name' => $method->name])->save();
        }
        $account = StoreGatewayAccount::query()->where('gateway', $method->gateway)->firstOrFail();
        $gateway = $this->gateways->get((string) $method->gateway);
        $reference = 'MK'.$order->tenant_id.'O'.$order->order_number.'X'.Str::upper(Str::random(6));
        $payUrl = StorePayments::payUrl($order) ?? throw new ApiException(409, 'not_awaiting_payment', __('payments.not_awaiting'));
        $store = (string) Tenant::query()->whereKey($order->tenant_id)->value('name');

        try {
            $session = $gateway->checkout($account, new GatewayCheckout(
                reference: $reference,
                amountCents: $order->totalCents(),
                description: (string) __('payments.gateways.item', ['number' => $order->order_number, 'store' => $store]),
                customerName: $order->customer_name,
                customerPhone: $order->customer_phone,
                customerEmail: $order->customer_email,
                returnUrl: $payUrl.'?ref='.$reference,
                webhookUrl: $this->webhookUrl($account->gateway, $account->webhook_token),
                city: $order->city ?? $order->governorate,
                address: $order->address,
            ));
        } catch (GatewayError $e) {
            Log::warning('store_gateway.checkout_failed', ['gateway' => $account->gateway, 'order' => $order->id, 'detail' => $e->detail]);
            if ($e->auth) {
                $account->forceFill(['status' => StoreGatewayAccount::FAILED, 'last_error' => mb_substr($e->getMessage(), 0, 255)])->save();
            }

            throw new ApiException(502, 'gateway_unavailable', __('payments.gateways.checkout_failed'));
        }

        StoreOnlinePayment::query()->create([
            'order_id' => $order->id, 'gateway' => $account->gateway, 'reference' => $reference,
            'external_id' => $session->externalId, 'amount' => Money::toDecimal($order->totalCents()), 'status' => StoreOnlinePayment::OPEN,
        ]);

        return $session->url;
    }

    /**
     * Brings a checkout up to date from its gateway (the customer's return, or a webhook). Null when the reference isn't
     * ours. With an order, the checkout must be one of its own.
     *
     * @throws GatewayError the gateway couldn't be asked
     */
    public function settle(string $reference, ?Order $order = null): ?StoreOnlinePayment
    {
        // Audited bypass: our reference is unique and random; the row then runs in its own store.
        $row = Tenancy::withoutTenant(fn () => StoreOnlinePayment::query()->where('reference', $reference)->first());
        if ($row === null || ($order !== null && $row->order_id !== $order->id)) {
            return null;
        }

        return Tenancy::runAs($row->tenant_id, fn (): StoreOnlinePayment => $this->settleInStore($row));
    }

    /**
     * A gateway's webhook for a store (/webhooks/payments/{gateway}/{token}). False when the account or signature is
     * wrong (403).
     *
     * @param  array<string, string>  $headers
     * @param  array<string, string>  $query
     *
     * @throws GatewayError
     */
    public function webhook(string $key, string $token, string $raw, array $headers, array $query): bool
    {
        if (! $this->gateways->has($key)) {
            return false;
        }
        // Audited bypass: the 40-character token is unique per store account and only in the gateway's settings.
        $account = Tenancy::withoutTenant(fn () => StoreGatewayAccount::query()->where('gateway', $key)->where('webhook_token', $token)->first());
        if ($account === null) {
            return false;
        }

        return Tenancy::runAs($account->tenant_id, function () use ($account, $key, $raw, $headers, $query): bool {
            $about = $this->gateways->get($key)->webhook($account, $raw, $headers, $query);
            if ($about === null) {
                return false;
            }
            $row = StoreOnlinePayment::query()->where('gateway', $key)->where(function ($q) use ($about): void {
                $q->where('reference', (string) ($about['reference'] ?? '-'))->orWhere('external_id', (string) ($about['external_id'] ?? '-'));
            })->first();
            if ($row !== null) {
                $this->settleInStore($row);
            }

            return true;
        });
    }

    /** The gateway an order was paid through online (its key and name), or null (inside the store's tenant). @return array{key: string, label: string}|null */
    public function paidVia(Order $order): ?array
    {
        $paid = $this->paidPayment($order);

        return $paid === null || ! $this->gateways->has($paid->gateway) ? null : ['key' => $paid->gateway, 'label' => $this->gateways->get($paid->gateway)->label()];
    }

    /**
     * Sends part or all of an order's online payment back through its gateway (the stage 5 refund «رجوع تلقائي»). The
     * gateway's own refusal comes back as a 422 in its words.
     */
    public function refund(Order $order, int $amountCents, ?string $reason): GatewayRefund
    {
        $paid = $this->paidPayment($order) ?? throw new ApiException(422, 'not_paid_online', __('payments.gateways.not_paid_online'));
        $account = StoreGatewayAccount::query()->where('gateway', $paid->gateway)->first()
            ?? throw new ApiException(422, 'gateway_disconnected', __('payments.gateways.disconnected_refund', ['gateway' => $this->gateways->get($paid->gateway)->label()]));
        try {
            return $this->gateways->get($paid->gateway)->refund($account, $paid, $amountCents, $reason);
        } catch (GatewayError $e) {
            Log::warning('store_gateway.refund_failed', ['gateway' => $paid->gateway, 'order' => $order->id, 'detail' => $e->detail]);

            throw new ApiException(422, 'gateway_refund_failed', $e->getMessage());
        }
    }

    private function paidPayment(Order $order): ?StoreOnlinePayment
    {
        return StoreOnlinePayment::query()->where('order_id', $order->id)->where('status', StoreOnlinePayment::PAID)->latest('id')->first();
    }

    /** What the pay page shows of an order's online checkouts. @return array<string, mixed>|null */
    public function customerView(Order $order): ?array
    {
        $last = StoreOnlinePayment::query()->where('order_id', $order->id)->latest('id')->first();

        return $last === null ? null : ['status' => $last->status, 'gateway' => $last->gateway];
    }

    private function settleInStore(StoreOnlinePayment $row): StoreOnlinePayment
    {
        if ($row->status === StoreOnlinePayment::PAID) {
            return $row;
        }
        $account = StoreGatewayAccount::query()->where('gateway', $row->gateway)->first();
        if ($account === null) {
            return $row;
        }
        $result = $this->gateways->get($row->gateway)->status($account, $row);

        if ($result->state !== GatewayResult::PAID) {
            $next = match ($result->state) {
                GatewayResult::WAITING => StoreOnlinePayment::WAITING,
                GatewayResult::FAILED => StoreOnlinePayment::FAILED,
                GatewayResult::EXPIRED => StoreOnlinePayment::EXPIRED,
                default => $row->status,
            };
            if ($next !== $row->status) {
                $row->forceFill(['status' => $next])->save();
            }

            return $row;
        }

        // The money must be the order's total, in pounds (fees the merchant passes on are on top, never instead).
        if (strtoupper($result->currency) !== 'EGP' || ($result->amountCents !== null && $result->amountCents < Money::toCents((string) $row->amount))) {
            Log::error('store_gateway.amount_mismatch', ['reference' => $row->reference, 'paid' => $result->amountCents, 'expected' => (string) $row->amount]);
            $row->forceFill(['status' => StoreOnlinePayment::FAILED])->save();

            return $row;
        }

        $paid = DB::transaction(function () use ($row, $result): bool {
            $locked = StoreOnlinePayment::query()->whereKey($row->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === StoreOnlinePayment::PAID) {
                return false;
            }
            $locked->forceFill([
                'status' => StoreOnlinePayment::PAID, 'payment_ref' => $result->paymentRef === null ? null : mb_substr($result->paymentRef, 0, 120),
                'method' => $result->method === null ? null : mb_substr($result->method, 0, 40), 'livemode' => (bool) $result->livemode, 'paid_at' => now(),
            ])->save();

            return true;
        });

        if ($paid) {
            $order = Order::query()->findOrFail($row->order_id);
            $label = $this->gateways->get($row->gateway)->label();
            // Paid while waiting: the order is confirmed (marked paid, deliveries and shipping follow); already confirmed
            // by hand (or cancelled meanwhile): only marked paid, so the merchant sees the money came in.
            if ($order->status === OrderStatus::AwaitingPayment) {
                $this->status->handle($order, OrderStatus::Confirmed, (string) __('payments.gateways.paid_note', ['gateway' => $label]), null);
            } elseif ($order->payment_status !== OrderPaymentState::Paid) {
                $this->payments->markPaid($order);
            }
        }

        return $row->refresh();
    }

    private function webhookUrl(string $gateway, string $token): string
    {
        return rtrim(PublicSite::url((string) config('landing.app_host')), '/').'/api/webhooks/payments/'.$gateway.'/'.$token;
    }
}
