<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Enums\LeadStatus;
use App\Enums\PlanFeature;
use App\Models\AbandonedLead;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/** «الطلبات المتروكة»: order forms and carts left after the phone was typed, with their cart reminders (read only). */
final class AbandonedLeadsResource extends CopilotResource
{
    public function key(): string
    {
        return 'abandoned_leads';
    }

    public function label(): string
    {
        return 'الطلبات المتروكة';
    }

    public function summary(): string
    {
        return 'Abandoned checkouts / landing forms / carts: customer name and phone, where (store checkout, cart, landing page), items, status (open, contacted, converted = ordered later, dismissed), reminders sent (WhatsApp / email), last reminder, recovered (an order within 7 days of a reminder), dates.';
    }

    public function available(CopilotContext $ctx): bool
    {
        return $ctx->allows(PlanFeature::AbandonedLeads);
    }

    public function model(): string
    {
        return AbandonedLead::class;
    }

    public function query(CopilotContext $ctx): Builder
    {
        return AbandonedLead::query();
    }

    public function fields(): array
    {
        return [
            Field::text('customer_name')->label('العميل')->hidden(),
            Field::text('customer_phone')->label('الموبايل')->hidden(),
            Field::enum('source', ['store', 'cart', 'landing'])->label('المكان')->labels(['store' => 'صفحة الدفع', 'cart' => 'السلة', 'landing' => 'صفحة هبوط'])->filterable(),
            Field::text('items')->label('المنتجات')->using(fn (Model $l) => $l instanceof AbandonedLead ? array_map(fn ($i) => $i['name'].' × '.$i['quantity'], (array) ($l->cart['items'] ?? [])) : []),
            Field::money('cart_total')->label('الإجمالي')->using(fn (Model $l) => $l instanceof AbandonedLead && isset($l->cart['total']) ? (string) $l->cart['total'] : null),
            Field::enum('status', LeadStatus::class)->label('الحالة')->filterable(),
            Field::int('reminders_sent')->label('التذكيرات')->filterable()->sortable(),
            Field::date('last_reminded_at')->label('آخر تذكير')->filterable()->sortable(),
            Field::date('recovered_at')->label('رجعت بالتذكير')->filterable()->sortable(),
            Field::date('created_at')->label('اتسابت')->filterable()->sortable(),
        ];
    }

    public function labelOf(Model $row): string
    {
        // No name or phone: they never reach the model.
        return '#'.$row->getKey();
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/abandoned';
    }
}
