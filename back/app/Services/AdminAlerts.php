<?php

declare(strict_types=1);

namespace App\Services;

use App\Billing\PlatformSettings;
use App\Enums\AdminAlert;
use App\Mail\AdminAlertMail;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Tenant;
use App\Models\User;
use App\Support\CairoTime;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Emails to the platform owner about what happens on the platform. Our own interface over
 * Laravel Mail: the provider is MAIL_MAILER in .env (log until the owner picks one), tests use
 * Mail::fake(). An alert never breaks the action that caused it: failures are only reported.
 */
final class AdminAlerts
{
    public function __construct(private readonly PlatformSettings $settings) {}

    public function email(): ?string
    {
        $email = $this->settings->all()['alert_email'] ?? null;

        return is_string($email) && $email !== '' ? $email : null;
    }

    /** @return list<string> */
    public function events(): array
    {
        $events = $this->settings->all()['alert_events'] ?? [];

        return array_values(array_intersect(AdminAlert::values(), is_array($events) ? $events : []));
    }

    public function wants(AdminAlert $alert): bool
    {
        return $this->email() !== null && in_array($alert->value, $this->events(), true);
    }

    /** False while mail only goes to the log (no provider yet). */
    public static function mailReady(): bool
    {
        return ! in_array((string) config('mail.default'), ['log', 'array'], true);
    }

    public function receiptSubmitted(Payment $payment, Invoice $invoice): void
    {
        $this->guard(AdminAlert::ReceiptSubmitted, function () use ($payment, $invoice): AdminAlertMail {
            $store = (string) Tenant::query()->whereKey($invoice->tenant_id)->value('name');
            $method = (string) (PaymentMethod::query()->whereKey($payment->method_key)->value('name') ?? $payment->method_key);

            return new AdminAlertMail(
                AdminAlert::ReceiptSubmitted->value,
                __('alerts.receipt.subject', ['store' => $store]),
                __('alerts.receipt.intro', ['store' => $store]),
                [
                    ['label' => __('alerts.receipt.store'), 'value' => $store],
                    ['label' => __('alerts.receipt.for'), 'value' => $this->invoiceFor($invoice)],
                    ['label' => __('alerts.receipt.amount'), 'value' => $this->money((string) $payment->amount)],
                    ['label' => __('alerts.receipt.method'), 'value' => $method],
                    ['label' => __('alerts.receipt.reference'), 'value' => (string) $payment->sender_ref],
                ],
                __('alerts.receipt.action'),
                $this->adminUrl('admin/payments'),
            );
        });
    }

    public function refundRequested(Invoice $invoice): void
    {
        $this->guard(AdminAlert::RefundRequested, function () use ($invoice): AdminAlertMail {
            $store = (string) Tenant::query()->whereKey($invoice->tenant_id)->value('name');

            return new AdminAlertMail(
                AdminAlert::RefundRequested->value,
                __('alerts.refund.subject', ['store' => $store]),
                __('alerts.refund.intro', ['store' => $store]),
                [
                    ['label' => __('alerts.refund.store'), 'value' => $store],
                    ['label' => __('alerts.refund.invoice'), 'value' => (string) $invoice->number],
                    ['label' => __('alerts.refund.amount'), 'value' => $this->money((string) $invoice->total)],
                    ['label' => __('alerts.refund.reason'), 'value' => (string) $invoice->refund_reason],
                ],
                __('alerts.refund.action'),
                $this->adminUrl('admin/refunds'),
            );
        });
    }

    /** A store opened a support conversation. */
    public function supportTicket(Tenant $tenant, int $number, string $topic, string $preview): void
    {
        $this->guard(AdminAlert::SupportTicket, fn (): AdminAlertMail => new AdminAlertMail(
            AdminAlert::SupportTicket->value,
            __('alerts.support.subject', ['number' => $number, 'store' => $tenant->name]),
            __('alerts.support.intro', ['store' => $tenant->name]),
            [
                ['label' => __('alerts.support.number'), 'value' => '#'.$number],
                ['label' => __('alerts.support.store'), 'value' => $tenant->name],
                ['label' => __('alerts.support.topic'), 'value' => $topic],
                ['label' => __('alerts.support.message'), 'value' => $preview],
            ],
            __('alerts.support.action'),
            $this->adminUrl('admin/support?ticket='.$number),
        ));
    }

    public function storeRegistered(Tenant $tenant, User $owner, string $host): void
    {
        $this->guard(AdminAlert::StoreRegistered, fn (): AdminAlertMail => new AdminAlertMail(
            AdminAlert::StoreRegistered->value,
            __('alerts.store.subject', ['store' => $tenant->name]),
            __('alerts.store.intro'),
            array_values(array_filter([
                ['label' => __('alerts.store.store'), 'value' => $tenant->name],
                ['label' => __('alerts.store.owner'), 'value' => $owner->name],
                ['label' => __('alerts.store.phone'), 'value' => (string) $owner->phone],
                $owner->email ? ['label' => __('alerts.store.email'), 'value' => (string) $owner->email] : null,
                ['label' => __('alerts.store.address'), 'value' => $host],
            ])),
            __('alerts.store.action'),
            $this->adminUrl('admin/stores/'.$tenant->id),
        ));
    }

    /** @param  array{new_stores: int, orders: int, sales: int, revenue: int, pending_payments: int, refund_requests: int, expiring_week: int}  $day */
    public function dailySummary(CarbonImmutable $date, array $day): void
    {
        $this->guard(AdminAlert::DailySummary, fn (): AdminAlertMail => new AdminAlertMail(
            AdminAlert::DailySummary->value,
            __('alerts.daily.subject', ['date' => $date->setTimezone(CairoTime::ZONE)->format('Y-m-d')]),
            __('alerts.daily.intro'),
            [
                ['label' => __('alerts.daily.new_stores'), 'value' => (string) $day['new_stores']],
                ['label' => __('alerts.daily.orders'), 'value' => (string) $day['orders']],
                ['label' => __('alerts.daily.sales'), 'value' => $this->money(Money::toDecimal($day['sales']))],
                ['label' => __('alerts.daily.revenue'), 'value' => $this->money(Money::toDecimal($day['revenue']))],
                ['label' => __('alerts.daily.pending_payments'), 'value' => (string) $day['pending_payments']],
                ['label' => __('alerts.daily.refund_requests'), 'value' => (string) $day['refund_requests']],
                ['label' => __('alerts.daily.expiring'), 'value' => (string) $day['expiring_week']],
            ],
            __('alerts.daily.action'),
            $this->adminUrl('admin'),
        ));
    }

    /** Sent right away (not queued) so a wrong provider setting shows up on the button. */
    public function sendTest(string $email): void
    {
        Mail::to($email)->sendNow(new AdminAlertMail(
            'test',
            __('alerts.test.subject'),
            __('alerts.test.intro'),
            [],
            __('alerts.test.action'),
            $this->adminUrl('admin'),
        ));
    }

    /** @param  callable(): AdminAlertMail  $build */
    private function guard(AdminAlert $alert, callable $build): void
    {
        if (! $this->wants($alert)) {
            return;
        }

        try {
            Mail::to($this->email())->queue($build());
        } catch (Throwable $e) {
            report($e);
        }
    }

    private function invoiceFor(Invoice $invoice): string
    {
        $snapshot = $invoice->snapshot;
        if ($invoice->theme_key !== null) {
            return __('alerts.for_theme', ['theme' => $snapshot['theme']['name'] ?? $invoice->theme_key]);
        }

        return __('alerts.for_plan', ['plan' => $snapshot['plan']['name'] ?? (string) $invoice->plan_key]);
    }

    private function money(string $amount): string
    {
        return __('alerts.money', ['amount' => number_format(Money::toCents($amount) / 100, 2)]);
    }

    private function adminUrl(string $path): string
    {
        return rtrim(PublicSite::url((string) config('landing.app_host')), '/').'/'.$path;
    }
}
