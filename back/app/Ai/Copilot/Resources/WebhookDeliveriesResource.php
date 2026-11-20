<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Models\WebhookDelivery;
use Illuminate\Database\Eloquent\Model;

/** The last attempts of the store's integrations (status, response code, error), to find why a link fails. No payloads. */
final class WebhookDeliveriesResource extends CopilotResource
{
    public function key(): string
    {
        return 'webhook_deliveries';
    }

    public function label(): string
    {
        return 'محاولات الربط';
    }

    public function summary(): string
    {
        return 'Integration attempts: which integration (webhook_id), event, status (success / failed…), response code, error, attempt, time. Newest first.';
    }

    public function model(): string
    {
        return WebhookDelivery::class;
    }

    public function fields(): array
    {
        return [
            Field::int('webhook_id')->label('رقم الربط')->filterable(),
            Field::text('event')->label('الحدث')->filterable(),
            Field::text('status')->label('الحالة')->filterable(),
            Field::int('response_code')->label('كود الرد')->filterable(),
            Field::text('error')->label('الخطأ'),
            Field::int('attempt')->label('المحاولة'),
            Field::date('created_at')->label('الوقت')->filterable()->sortable(),
        ];
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/settings/integrations';
    }
}
