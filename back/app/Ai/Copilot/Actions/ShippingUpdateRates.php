<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Actions\Shipping\SaveShippingCompany;
use App\Ai\Copilot\Changes\ActionPreview;
use App\Ai\Copilot\Changes\ValueOps;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Resources\ShippingCompaniesResource;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Ai\Copilot\Support\FormRequestRunner;
use App\Http\Requests\Dashboard\ShippingCompanyRequest;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\ShippingCompany;
use App\Models\ShippingCompanyRate;

/**
 * Changes shipping fees in one go (default fee and / or the fee of each governorate) with a money operation, for some
 * or all companies. Previewed per company (before → after), saved through ShippingCompanyRequest + SaveShippingCompany.
 */
final class ShippingUpdateRates extends CopilotAction
{
    public function key(): string
    {
        return 'shipping.update_rates';
    }

    public function label(): string
    {
        return 'تعديل أسعار الشحن';
    }

    public function summary(): string
    {
        return 'Raise / lower / set shipping fees: the default fee and the governorate fees, for some or all companies. A governorate without its own fee gets one computed from the default fee.';
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => [
            'company_ids' => ['type' => 'array', 'items' => ['type' => 'integer'], 'description' => 'Default: every active company.'],
            'fee' => ['type' => 'object', 'description' => 'A money op: {"add": 10} | {"percent": 15} | {"set": 60}, optional round {to, mode}.'],
            'governorates' => ['type' => 'array', 'items' => ['type' => 'string'], 'description' => 'Only these governorates (default: all governorates + the default fee).'],
        ], 'required' => ['fee']];
    }

    public function approval(): bool
    {
        return true;
    }

    public function columns(): array
    {
        return ['default_fee' => ['سعر الشحن الأساسي', 'money'], 'rates' => ['أسعار المحافظات', 'text']];
    }

    public function preview(array $args, CopilotContext $ctx): ActionPreview
    {
        $money = Field::money('fee');
        $op = is_array($args['fee'] ?? null) ? $args['fee'] : [];
        ValueOps::check($money, $op);
        $all = (array) config('landing.governorates');
        $only = isset($args['governorates']) ? array_values(array_intersect($all, array_map('strval', (array) $args['governorates']))) : null;
        if ($only === []) {
            throw new CopilotToolError('Unknown governorates. Use the names as written in the store, e.g. «القاهرة».');
        }

        $companies = ShippingCompany::query()->with('rates')->orderBy('position')
            ->when(isset($args['company_ids']), fn ($q) => $q->whereKey(array_map('intval', (array) $args['company_ids'])), fn ($q) => $q->where('is_active', true))
            ->get();
        if ($companies->isEmpty()) {
            throw new CopilotToolError('No shipping company matches.');
        }

        $items = [];
        foreach ($companies as $company) {
            $before = self::state($company);
            $after = $before;
            if ($only === null) {
                $after['default_fee'] = ValueOps::apply($money, $before['default_fee'], $op);
            }
            foreach ($only ?? $all as $governorate) {
                $current = $before['rates'][$governorate] ?? $before['default_fee'];
                $after['rates'][$governorate] = ValueOps::apply($money, $current, $op);
            }
            ksort($after['rates']);
            $items[] = ['entity_type' => 'shipping_companies', 'entity_id' => $company->id, 'label' => $company->name, 'before' => $before, 'after' => $after];
        }

        return new ActionPreview(
            summary: ValueOps::describe(Field::money('fees')->label('أسعار الشحن'), $op).' — '.count($items).' شركة'.($only !== null ? ' ('.implode('، ', array_slice($only, 0, 5)).(count($only) > 5 ? '…' : '').')' : ''),
            items: $items,
            spec: ['op' => $op, 'governorates' => $only],
        );
    }

    public function current(CopilotChangeItem $item, CopilotContext $ctx): ?array
    {
        $company = ShippingCompany::query()->with('rates')->find($item->entity_id);

        return $company === null ? ['gone' => true] : self::state($company);
    }

    public function apply(CopilotChangeItem $item, CopilotChangeSet $set, CopilotContext $ctx): void
    {
        $company = ShippingCompany::query()->with('rates')->findOrFail($item->entity_id);
        $after = (array) $item->after;
        $rates = [];
        $existing = $company->rates->keyBy('governorate');
        foreach ((array) config('landing.governorates') as $governorate) {
            $row = $existing->get($governorate);
            $fee = $after['rates'][$governorate] ?? null;
            if ($row === null && $fee === null) {
                continue;
            }
            $rates[] = ['governorate' => $governorate, 'fee' => $fee, 'is_available' => $row?->is_available ?? true];
        }
        $body = [...app(ShippingCompaniesResource::class)->body($company), 'default_fee' => (string) ($after['default_fee'] ?? $company->default_fee), 'rates' => $rates];
        /** @var ShippingCompanyRequest $request */
        $request = FormRequestRunner::run(ShippingCompanyRequest::class, $body, $ctx->user, 'shipping_company', $company);
        app(SaveShippingCompany::class)->handle($request->companyData(), $request->rates(), $company);
    }

    /**
     * The fees of a company: its default and every governorate with its own available fee.
     *
     * @return array{default_fee: string, rates: array<string, string>}
     */
    private static function state(ShippingCompany $company): array
    {
        $rates = [];
        foreach ($company->rates as $rate) {
            /** @var ShippingCompanyRate $rate */
            if ($rate->is_available && $rate->fee !== null) {
                $rates[(string) $rate->governorate] = number_format((float) $rate->fee, 2, '.', '');
            }
        }
        ksort($rates);

        return ['default_fee' => number_format((float) $company->default_fee, 2, '.', ''), 'rates' => $rates];
    }
}
