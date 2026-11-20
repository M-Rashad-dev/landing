<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Actions\Shipping\SaveShippingCompany;
use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Http\Requests\Dashboard\ShippingCompanyRequest;
use App\Models\ShippingCompany;
use App\Models\ShippingCompanyRate;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;

/**
 * «شركات الشحن» the customer chooses at checkout. Every save sends the company's governorate fees too (the request
 * replaces them), so a change never loses them. Per-governorate fees change through the action shipping.update_rates.
 */
final class ShippingCompaniesResource extends CopilotResource
{
    public function key(): string
    {
        return 'shipping_companies';
    }

    public function label(): string
    {
        return 'شركات الشحن';
    }

    public function summary(): string
    {
        return 'Shipping companies: default fee, delivery days, active or not. Governorate fees: use the action shipping.update_rates.';
    }

    public function model(): string
    {
        return ShippingCompany::class;
    }

    public function query(CopilotContext $ctx): Builder
    {
        return ShippingCompany::query()->orderBy('position');
    }

    public function fields(): array
    {
        return [
            Field::text('name')->label('الاسم')->searchable()->sortable()->editable(),
            Field::money('default_fee')->label('سعر الشحن الأساسي')->filterable()->sortable()->editable(),
            Field::int('delivery_days_min')->label('أقل مدة (أيام)')->editable(),
            Field::int('delivery_days_max')->label('أقصى مدة (أيام)')->editable(),
            Field::bool('is_active')->label('شغالة')->filterable()->bulk(),
            Field::media('media_id')->label('اللوجو')->images()->notInTable()->editable(),
        ];
    }

    public function with(): array
    {
        return ['rates'];
    }

    public function request(): ?string
    {
        return ShippingCompanyRequest::class;
    }

    public function routeParameter(): string
    {
        return 'shipping_company';
    }

    public function body(Model $row): array
    {
        return [
            'name' => $row->getAttribute('name'),
            'media_id' => $row->getAttribute('media_id'),
            'delivery_days_min' => $row->getAttribute('delivery_days_min'),
            'delivery_days_max' => $row->getAttribute('delivery_days_max'),
            'default_fee' => (string) $row->getAttribute('default_fee'),
            'is_active' => (bool) $row->getAttribute('is_active'),
            'rates' => self::rates($row),
        ];
    }

    /** @return list<array{governorate: string, fee: string|null, is_available: bool}> */
    public static function rates(Model $row): array
    {
        $rates = $row->relationLoaded('rates') ? $row->getRelation('rates') : $row->rates()->get();

        return $rates->map(fn (ShippingCompanyRate $r) => ['governorate' => (string) $r->governorate, 'fee' => $r->fee === null ? null : (string) $r->fee, 'is_available' => (bool) $r->is_available])->values()->all();
    }

    public function persist(FormRequest $validated, ?Model $row): Model
    {
        /** @var ShippingCompanyRequest $validated */
        return app(SaveShippingCompany::class)->handle($validated->companyData(), $validated->rates(), $row instanceof ShippingCompany ? $row : null);
    }

    public function createDefaults(): array
    {
        return ['rates' => []];
    }

    public function draft(): array
    {
        return ['is_active' => false];
    }

    public function publish(): array
    {
        return ['is_active' => true];
    }

    public function remove(Model $row): void
    {
        app(SaveShippingCompany::class)->delete($row instanceof ShippingCompany ? $row : throw new \LogicException('Not a company.'));
    }

    public function createFields(): array
    {
        return ['name' => 'required, ≤ 60', 'default_fee' => 'required, EGP', 'delivery_days_min' => '0–60', 'delivery_days_max' => '0–60', 'rates' => 'optional: only governorates that differ from the default, list of {governorate (exact Arabic name, e.g. الإسكندرية), fee (EGP; null = the default fee), is_available (false = not served)}', 'media_id' => 'optional: an attached image as the logo'];
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/shipping';
    }
}
