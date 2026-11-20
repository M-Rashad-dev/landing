<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Models\Customer;
use App\Support\CustomerFilters;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * «العملاء»: every phone that ordered, with its order stats (the customers page's own query). The model sees first names
 * only, never phones, emails or addresses; the merchant's tables and files have everything.
 */
final class CustomersResource extends CopilotResource
{
    public function key(): string
    {
        return 'customers';
    }

    public function label(): string
    {
        return 'العملاء';
    }

    public function summary(): string
    {
        return 'Customers who ordered: orders count, delivered count, returned / fake count, spent (delivered orders), first and last order dates. Segments: repeat, risky, blocked.';
    }

    public function model(): string
    {
        return Customer::class;
    }

    public function fields(): array
    {
        return [
            Field::text('name')->label('الاسم'),
            Field::text('phone')->label('الموبايل')->hidden(),
            Field::text('email')->label('الإيميل')->hidden(),
            Field::text('governorate')->label('المحافظة')->filterable(),
            Field::text('address')->label('العنوان')->hidden(),
            Field::int('orders_count')->label('عدد الطلبات')->using(fn (Model $c) => (int) $c->getAttribute('orders_count')),
            Field::int('delivered_count')->label('اتسلّمت')->using(fn (Model $c) => (int) $c->getAttribute('delivered_count')),
            Field::int('bad_count')->label('مرتجع / وهمي')->using(fn (Model $c) => (int) $c->getAttribute('bad_count')),
            Field::money('spent')->label('اشترى بـ')->using(fn (Model $c) => number_format((float) $c->getAttribute('spent'), 2, '.', '')),
            Field::date('first_order_at')->label('أول طلب')->filterable()->sortable(),
            Field::date('last_order_at')->label('آخر طلب')->filterable()->sortable(),
        ];
    }

    public function namedFilters(): array
    {
        return [
            'q' => ['type' => 'string', 'description' => 'Search by name.'],
            'segment' => ['type' => 'string', 'enum' => CustomerFilters::SEGMENTS, 'description' => 'repeat = 2+ orders, risky = has returned / damaged / fake orders, blocked.'],
            'sort' => ['type' => 'string', 'enum' => CustomerFilters::SORTS, 'description' => 'orders = most orders first, spent = most spent first.'],
        ];
    }

    public function base(array $named, CopilotContext $ctx): Builder
    {
        return CustomerFilters::apply([
            'q' => isset($named['q']) && is_scalar($named['q']) ? mb_substr((string) $named['q'], 0, 100) : null,
            'segment' => self::pick($named, 'segment', CustomerFilters::SEGMENTS),
            'sort' => self::pick($named, 'sort', CustomerFilters::SORTS),
        ]);
    }

    /** The model gets the first name only. */
    public function present(Model $row, bool $forModel): array
    {
        $out = parent::present($row, $forModel);
        if ($forModel && is_string($out['name'] ?? null)) {
            $out['name'] = explode(' ', trim($out['name']))[0];
        }

        return $out;
    }

    public function labelOf(Model $row): string
    {
        return (string) ($row->getAttribute('name') ?: 'عميل #'.$row->getKey());
    }

    public function url(?Model $row): ?string
    {
        return $row === null ? '/dashboard/customers' : "/dashboard/customers/{$row->getKey()}";
    }
}
