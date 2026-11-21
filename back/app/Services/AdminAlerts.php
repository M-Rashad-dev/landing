<?php

declare(strict_types=1);

namespace App\Services;

use App\Billing\PlatformSettings;
use App\Enums\AdminAlert;
use App\Enums\NotificationEvent;
use App\Mail\NotificationMail;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Tenant;
use App\Models\User;
use App\Notifications\Notice;
use App\Notifications\NotificationCenter;
use App\Support\CairoTime;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Mail;

/**
 * What the platform owner is told about the platform: the bell of every super admin, plus a
 * WhatsApp message or an email (admin settings: which alerts, which channel, which phone / email).
 */
final class AdminAlerts
{
    public function __construct(
        private readonly PlatformSettings $settings,
        private readonly NotificationCenter $center,
    ) {}

    /** @return list<string> */
    public function events(): array
    {
        $events = $this->settings->all()['alert_events'] ?? [];

        return array_values(array_intersect(AdminAlert::values(), is_array($events) ? $events : []));
    }

    /** False while mail only goes to the log (no provider yet). */
    public static function mailReady(): bool
    {
        return ! in_array((string) config('mail.default'), ['log', 'array'], true);
    }

    public function receiptSubmitted(Payment $payment, Invoice $invoice): void
    {
        $store = (string) Tenant::query()->whereKey($invoice->tenant_id)->value('name');
        $method = (string) (PaymentMethod::query()->whereKey($payment->method_key)->value('name') ?? $payment->method_key);
        $amount = Money::toCents((string) $payment->amount);

        $this->center->toPlatform(new Notice(
            NotificationEvent::ReceiptSubmitted,
            __('alerts.receipt.subject', ['store' => $store]),
            __('alerts.receipt.intro', ['store' => $store]),
            '/admin/payments',
            [
                ['label' => __('alerts.receipt.store'), 'value' => $store],
                ['label' => __('alerts.receipt.for'), 'value' => $this->invoiceFor($invoice)],
                ['label' => __('alerts.receipt.amount'), 'value' => $this->money($amount)],
                ['label' => __('alerts.receipt.method'), 'value' => $method],
                ['label' => __('alerts.receipt.reference'), 'value' => (string) $payment->sender_ref],
            ],
            __('alerts.receipt.action'),
            'admin_new_receipt',
            [$store, $this->plain($amount)],
        ), $invoice->tenant_id);
    }

    public function refundRequested(Invoice $invoice): void
    {
        $store = (string) Tenant::query()->whereKey($invoice->tenant_id)->value('name');
        $amount = Money::toCents((string) $invoice->total);

        $this->center->toPlatform(new Notice(
            NotificationEvent::RefundRequested,
            __('alerts.refund.subject', ['store' => $store]),
            __('alerts.refund.intro', ['store' => $store]),
            '/admin/refunds',
            [
                ['label' => __('alerts.refund.store'), 'value' => $store],
                ['label' => __('alerts.refund.invoice'), 'value' => (string) $invoice->number],
                ['label' => __('alerts.refund.amount'), 'value' => $this->money($amount)],
                ['label' => __('alerts.refund.reason'), 'value' => (string) $invoice->refund_reason],
            ],
            __('alerts.refund.action'),
            'admin_refund_request',
            [$store, $this->plain($amount), (string) $invoice->number],
        ), $invoice->tenant_id);
    }

    /** A store opened a support conversation. */
    public function supportTicket(Tenant $tenant, int $number, string $topic, string $preview): void
    {
        $this->center->toPlatform(new Notice(
            NotificationEvent::SupportTicket,
            __('alerts.support.subject', ['number' => $number, 'store' => $tenant->name]),
            __('alerts.support.intro', ['store' => $tenant->name]),
            '/admin/support?ticket='.$number,
            [
                ['label' => __('alerts.support.number'), 'value' => '#'.$number],
                ['label' => __('alerts.support.store'), 'value' => $tenant->name],
                ['label' => __('alerts.support.topic'), 'value' => $topic],
                ['label' => __('alerts.support.message'), 'value' => $preview],
            ],
            __('alerts.support.action'),
            'admin_support_ticket',
            [(string) $number, $tenant->name, $topic],
        ), $tenant->id);
    }

    public function storeRegistered(Tenant $tenant, User $owner, string $host): void
    {
        $this->center->toPlatform(new Notice(
            NotificationEvent::StoreRegistered,
            __('alerts.store.subject', ['store' => $tenant->name]),
            __('alerts.store.intro'),
            '/admin/stores/'.$tenant->id,
            array_values(array_filter([
                ['label' => __('alerts.store.store'), 'value' => $tenant->name],
                ['label' => __('alerts.store.owner'), 'value' => $owner->name],
                ['label' => __('alerts.store.phone'), 'value' => (string) $owner->phone],
                $owner->email ? ['label' => __('alerts.store.email'), 'value' => (string) $owner->email] : null,
                ['label' => __('alerts.store.address'), 'value' => $host],
            ])),
            __('alerts.store.action'),
            'admin_new_store',
            [$tenant->name, $owner->name, $this->localPhone((string) $owner->phone)],
        ), $tenant->id);
    }

    /** The AI paused itself after failures in a row (the bell only: support falls back to people meanwhile). */
    public function aiPaused(string $error, int $minutes): void
    {
        $this->center->toPlatform(new Notice(
            NotificationEvent::AiPaused,
            __('alerts.ai_paused.subject'),
            __('alerts.ai_paused.intro', ['minutes' => $minutes]),
            '/admin/ai',
            [['label' => __('alerts.ai_paused.error'), 'value' => $error]],
            __('alerts.ai_paused.action'),
            dedupeKey: 'ai_paused:'.now()->format('YmdHi'),
        ));
    }

    /** The AI provider refused the platform's account (credit, key): once an hour at most. */
    public function aiProvider(string $error): void
    {
        $this->center->toPlatform(new Notice(
            NotificationEvent::AiPaused,
            __('alerts.ai_provider.subject'),
            __('alerts.ai_provider.intro'),
            '/admin/ai',
            [['label' => __('alerts.ai_paused.error'), 'value' => $error]],
            __('alerts.ai_paused.action'),
            dedupeKey: 'ai_provider:'.now()->format('YmdH'),
        ));
    }

    /** @param  array{new_stores: int, orders: int, sales: int, revenue: int, pending_payments: int, refund_requests: int, expiring_week: int}  $day */
    public function dailySummary(CarbonImmutable $date, array $day): void
    {
        $label = $date->setTimezone(CairoTime::ZONE)->format('Y-m-d');

        $this->center->toPlatform(new Notice(
            NotificationEvent::DailySummary,
            __('alerts.daily.subject', ['date' => $label]),
            __('alerts.daily.intro'),
            '/admin',
            [
                ['label' => __('alerts.daily.new_stores'), 'value' => (string) $day['new_stores']],
                ['label' => __('alerts.daily.orders'), 'value' => (string) $day['orders']],
                ['label' => __('alerts.daily.sales'), 'value' => $this->money($day['sales'])],
                ['label' => __('alerts.daily.revenue'), 'value' => $this->money($day['revenue'])],
                ['label' => __('alerts.daily.pending_payments'), 'value' => (string) $day['pending_payments']],
                ['label' => __('alerts.daily.refund_requests'), 'value' => (string) $day['refund_requests']],
                ['label' => __('alerts.daily.expiring'), 'value' => (string) $day['expiring_week']],
            ],
            __('alerts.daily.action'),
            'admin_daily_summary',
            [$label, (string) $day['new_stores'], (string) $day['orders'], (string) $day['pending_payments']],
            dedupeKey: 'daily:'.$label,
        ));
    }

    /** Sent right away (not queued) so a wrong provider setting shows up on the button. */
    public function sendTest(string $email): void
    {
        Mail::to($email)->send(new NotificationMail(
            'test',
            __('alerts.test.subject'),
            __('alerts.test.intro'),
            [],
            __('alerts.test.action'),
            rtrim(PublicSite::url((string) config('landing.app_host')), '/').'/admin',
            __('notifications.mail.brand_admin'),
        ));
    }

    private function invoiceFor(Invoice $invoice): string
    {
        $snapshot = $invoice->snapshot;
        if ($invoice->type === 'ai_credit') {
            return __('alerts.for_ai_credit');
        }
        if ($invoice->theme_key !== null) {
            return __('alerts.for_theme', ['theme' => $snapshot['theme']['name'] ?? $invoice->theme_key]);
        }

        return __('alerts.for_plan', ['plan' => $snapshot['plan']['name'] ?? (string) $invoice->plan_key]);
    }

    private function money(int $cents): string
    {
        return __('alerts.money', ['amount' => $this->plain($cents)]);
    }

    /** 1,200 / 1,200.50 (WhatsApp templates add "جنيه" themselves). */
    private function plain(int $cents): string
    {
        return number_format($cents / 100, $cents % 100 === 0 ? 0 : 2);
    }

    private function localPhone(string $e164): string
    {
        return str_starts_with($e164, '+20') ? '0'.substr($e164, 3) : $e164;
    }
}
