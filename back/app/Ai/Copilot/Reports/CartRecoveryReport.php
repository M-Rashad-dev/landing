<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Reports;

use App\Ai\Copilot\Contracts\CopilotReport;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\ReportResult;
use App\Enums\PlanFeature;
use App\Models\CartRecoverySetting;
use App\Models\MessageWallet;
use App\Recovery\CartRecovery;

/** Cart reminders: on / off, the timings, the WhatsApp message balance, and the last 30 days (sent, brought back). */
final class CartRecoveryReport extends CopilotReport
{
    public function __construct(private readonly CartRecovery $recovery) {}

    public function key(): string
    {
        return 'cart_recovery';
    }

    public function label(): string
    {
        return 'تذكير السلات المتروكة';
    }

    public function summary(): string
    {
        return 'Abandoned cart reminders: whether they are on (WhatsApp / email), first reminder after N minutes, second after N hours (with its coupon), WhatsApp message balance left (bought in packs from «الطلبات المتروكة»), and the last 30 days: reminders sent per channel, leads that ordered after a reminder and their sales.';
    }

    public function available(CopilotContext $ctx): bool
    {
        return $ctx->allows(PlanFeature::AbandonedLeads);
    }

    public function params(): array
    {
        return ['type' => 'object', 'properties' => ['days' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 90, 'description' => 'Days back for the numbers, default 30.']]];
    }

    public function run(array $params, CopilotContext $ctx): ReportResult
    {
        $s = CartRecoverySetting::current();
        $stats = $this->recovery->stats(max(1, min(90, (int) ($params['days'] ?? 30))));

        return new ReportResult(
            summary: [
                'enabled' => $s->enabled,
                'whatsapp' => $s->whatsapp,
                'whatsapp_available' => $this->recovery->whatsappAvailable(),
                'email' => $s->email,
                'first_reminder_minutes' => $s->first_minutes,
                'second_reminder_hours' => $s->second_hours,
                'second_reminder_coupon' => $s->coupon_mode,
                'message_balance' => (int) (MessageWallet::query()->value('balance') ?? 0),
                'period_days' => max(1, min(90, (int) ($params['days'] ?? 30))),
                'numbers' => $stats,
                'rules' => 'One WhatsApp reminder = one message from the balance; emails are free. Nothing is sent 11 pm – 9 am Cairo. Reminders stop when the phone orders, the lead is handled, blocked, opted out, or 3 days old. Settings and buying messages are on the abandoned orders page.',
            ],
            title: 'تذكير السلات',
            columns: [['key' => 'metric', 'label' => 'البند', 'kind' => 'text'], ['key' => 'value', 'label' => 'القيمة', 'kind' => 'text']],
            rows: [
                ['metric' => 'تذكيرات اتبعتت', 'value' => (string) $stats['reminders']],
                ['metric' => 'رجعت بالتذكير', 'value' => (string) $stats['recovered']],
                ['metric' => 'مبيعاتها', 'value' => number_format($stats['revenue'], 2, '.', '')],
            ],
        );
    }
}
