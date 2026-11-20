<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Enums\WebhookKind;
use App\Models\Webhook;
use Illuminate\Database\Eloquent\Model;

/**
 * «الربط»: the store's integrations (webhooks, Google Sheets), read only. The URL is the merchant's only (it can carry
 * a key); the secret is never a field at all.
 */
final class WebhooksResource extends CopilotResource
{
    public function key(): string
    {
        return 'webhooks';
    }

    public function label(): string
    {
        return 'الربط (Webhooks و Google Sheets)';
    }

    public function summary(): string
    {
        return 'Integrations: kind, name, events, active or not, failures in a row, last status and time. See webhook_deliveries for the last attempts, webhooks.test to try one.';
    }

    public function model(): string
    {
        return Webhook::class;
    }

    public function fields(): array
    {
        return [
            Field::text('name')->label('الاسم')->searchable(),
            Field::enum('kind', WebhookKind::class)->label('النوع')->filterable(),
            Field::text('url')->label('الرابط')->hidden(),
            Field::text('events')->label('الأحداث')->using(fn (Model $w) => (array) ($w->getAttribute('events') ?? [])),
            Field::bool('is_active')->label('شغال')->filterable(),
            Field::int('failures_count')->label('فشل متتالي')->filterable()->sortable(),
            Field::text('last_status')->label('آخر حالة')->filterable(),
            Field::date('last_delivery_at')->label('آخر محاولة')->sortable(),
        ];
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/settings/integrations';
    }
}
