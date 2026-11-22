<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\MessagePurpose;
use App\Mail\CustomerOrderMail;
use App\Mail\Store\StoreMailer;
use App\Messaging\WhatsApp\WhatsAppError;
use App\Messaging\WhatsApp\WhatsAppMessenger;
use App\Messaging\WhatsApp\WhatsAppTemplates;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderPayment;
use App\Models\StorePaymentSetting;
use App\Models\Tenant;
use App\Notifications\CustomerNotices;
use App\Services\PublicSite;
use App\Store\Payments\StorePayments;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Str;
use Throwable;

/**
 * One order message to its customer. Channel: the customer's own choice (store account), else
 * email when they gave one, else WhatsApp when they agreed at checkout; nothing otherwise.
 * WhatsApp that can't go falls back to email (the store's own mailbox when set, see StoreMailer). Logged on the
 * order (outbound_messages). Never retried.
 */
final class DeliverCustomerNotice implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public function __construct(public readonly int $tenantId, public readonly int $orderId, public readonly string $event) {}

    public function handle(WhatsAppMessenger $messenger, StoreMailer $mailer): void
    {
        Tenancy::runAs($this->tenantId, function () use ($messenger, $mailer): void {
            $order = Order::query()->with('items')->find($this->orderId);
            if ($order === null) {
                return;
            }
            // Orders from before tracking links get one now (the WhatsApp button needs it).
            if ($order->track_token === null) {
                $order->forceFill(['track_token' => strtolower(Str::random(12))])->save();
            }
            $customer = $order->customer_id === null ? null : Customer::query()->find($order->customer_id);
            $email = $order->customer_email ?: $customer?->email;
            $choice = $customer?->notify_channel;
            // Choosing WhatsApp in the account is consent too.
            $whatsappAllowed = $order->whatsapp_opt_in || $choice === 'whatsapp';

            $useWhatsapp = $whatsappAllowed && ($choice === 'whatsapp' || $email === null || $email === '');
            if ($useWhatsapp && $this->whatsapp($order, $messenger)) {
                return;
            }
            if ($email !== null && $email !== '') {
                $this->mail($order, $email, $messenger, $mailer);
            }
        });
    }

    private function whatsapp(Order $order, WhatsAppMessenger $messenger): bool
    {
        if (! $messenger->configured() || ! WhatsAppTemplates::has('order_'.$this->event)) {
            return false;
        }

        $store = $this->store();
        $params = match ($this->event) {
            CustomerNotices::RECEIVED => [(string) $order->order_number, $store, $this->plain(Money::toCents((string) $order->total))],
            CustomerNotices::SHIPPED => [(string) $order->order_number, $store, $order->shipping_company_name ?: __('customer_notices.shipping_company')],
            default => [(string) $order->order_number, $store],
        };
        $params = array_map(fn (string $p): string => trim((string) preg_replace('/\s+/u', ' ', $p)) ?: '—', $params);

        try {
            $messenger->sendTemplate($order->customer_phone, 'order_'.$this->event, $params, $order->track_token, $this->purpose(), $this->tenantId, $order->id);

            return true;
        } catch (WhatsAppError) {
            return false;
        }
    }

    private function mail(Order $order, string $email, WhatsAppMessenger $messenger, StoreMailer $mailer): void
    {
        $store = $this->store();
        $key = 'customer_notices.'.$this->event;
        $rows = $order->items->map(fn (OrderItem $item): array => [
            'label' => $item->product_name.($item->quantity > 1 ? ' × '.$item->quantity : ''),
            'value' => $this->money(Money::toCents((string) $item->line_total)),
        ])->values()->all();
        $rows[] = ['label' => __('customer_notices.total'), 'value' => $this->money(Money::toCents((string) $order->total))];
        if ($this->event === CustomerNotices::SHIPPED && $order->tracking_number) {
            $rows[] = ['label' => __('customer_notices.tracking_number'), 'value' => (string) $order->tracking_number];
        }
        // Payment messages lead to the pay page (the receipt goes there).
        $payment = in_array($this->event, [CustomerNotices::PAYMENT_DUE, CustomerNotices::PAYMENT_REJECTED], true);
        if ($payment && $order->payment_method_name) {
            $rows[] = ['label' => __('customer_notices.payment_method'), 'value' => (string) $order->payment_method_name];
        }
        $reason = $this->event === CustomerNotices::PAYMENT_REJECTED ? (string) ($order->payments()->where('status', OrderPayment::REJECTED)->latest('id')->value('reject_reason') ?? '') : '';

        try {
            $via = $mailer->send($this->tenantId, $email, new CustomerOrderMail(
                $this->event,
                $store,
                __($key.'.subject', ['number' => $order->order_number, 'store' => $store]),
                __($key.'.intro', ['store' => $store, 'company' => $order->shipping_company_name ?: __('customer_notices.shipping_company'), 'reason' => $reason, 'days' => StorePaymentSetting::current()->cancel_after_days]),
                $rows,
                __($payment ? 'customer_notices.pay' : 'customer_notices.track'),
                $payment ? StorePayments::payUrl($order) : ($order->track_token === null ? null : rtrim(PublicSite::url((string) config('landing.platform_domain')), '/').'/t/'.$order->track_token),
                __('customer_notices.footer', ['store' => $store]),
            ));
            $messenger->logEmail($email, $this->purpose(), $this->tenantId, $order->id, $via->value);
        } catch (Throwable $e) {
            report($e);
        }
    }

    private function purpose(): MessagePurpose
    {
        return MessagePurpose::from('order_'.$this->event);
    }

    private function store(): string
    {
        return (string) Tenant::query()->whereKey($this->tenantId)->value('name');
    }

    private function money(int $cents): string
    {
        return __('customer_notices.money', ['amount' => $this->plain($cents)]);
    }

    private function plain(int $cents): string
    {
        return number_format($cents / 100, $cents % 100 === 0 ? 0 : 2);
    }
}
