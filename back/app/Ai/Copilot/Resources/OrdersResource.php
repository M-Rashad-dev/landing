<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Support\OrderFilters;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * «الطلبات»: store and landing-page orders. The named filters are the orders page's own (OrderFilters), so the copilot
 * finds exactly what the page shows. The customer's name, phones and address are for the merchant only.
 */
final class OrdersResource extends CopilotResource
{
    private const SORTS = ['latest', 'oldest', 'total_desc', 'total_asc'];

    public function key(): string
    {
        return 'orders';
    }

    public function label(): string
    {
        return 'الطلبات';
    }

    public function summary(): string
    {
        return 'Orders (cash on delivery): number, status (new → confirmed → shipped → delivered, or returned / damaged / fake / cancelled), total, governorate, items, date.';
    }

    public function model(): string
    {
        return Order::class;
    }

    public function fields(): array
    {
        return [
            Field::int('order_number')->label('رقم الطلب')->filterable()->sortable(),
            Field::enum('status', OrderStatus::class)->label('الحالة')->filterable(),
            Field::text('customer_name')->label('العميل')->hidden(),
            Field::text('customer_phone')->label('الموبايل')->hidden(),
            Field::text('governorate')->label('المحافظة')->filterable(),
            Field::text('city')->label('المدينة')->hidden(),
            Field::text('address')->label('العنوان')->hidden(),
            Field::text('items')->label('المنتجات')->using(fn (Model $o) => $o->relationLoaded('items')
                ? $o->items->map(fn ($i) => $i->product_name.' × '.$i->quantity.($i->is_gift ? ' (هدية)' : ''))->all()
                : []),
            Field::money('total')->label('الإجمالي')->filterable()->sortable(),
            Field::money('shipping_fee')->label('الشحن'),
            Field::text('discount_code')->label('كود الخصم')->filterable(),
            Field::text('shipping_company_name')->label('شركة الشحن'),
            Field::text('source')->label('المصدر')->using(fn (Model $o) => $o->getAttribute('source') === 'store' ? 'المتجر' : 'صفحة هبوط'),
            Field::date('created_at')->label('التاريخ')->filterable()->sortable(),
        ];
    }

    public function namedFilters(): array
    {
        return [
            'q' => ['type' => 'string', 'description' => 'Order number (or the merchant\'s own search text).'],
            'status' => ['type' => 'array', 'items' => ['type' => 'string', 'enum' => OrderStatus::values()], 'description' => 'One or more statuses.'],
            'source' => ['type' => 'string', 'enum' => ['store', 'landing']],
            'page_id' => ['type' => 'integer', 'description' => 'Orders of one landing page.'],
            'product_id' => ['type' => 'integer'],
            'customer_id' => ['type' => 'integer'],
            'shipping_company_id' => ['type' => 'integer'],
            'from' => ['type' => 'string', 'description' => 'YYYY-MM-DD, Cairo day (included).'],
            'to' => ['type' => 'string', 'description' => 'YYYY-MM-DD, Cairo day (included).'],
            'duplicate' => ['type' => 'boolean', 'description' => 'Only orders flagged as possible duplicates.'],
            'sort' => ['type' => 'string', 'enum' => self::SORTS],
        ];
    }

    public function base(array $named, CopilotContext $ctx): Builder
    {
        $status = $named['status'] ?? null;
        $params = array_filter([
            'q' => isset($named['q']) && is_scalar($named['q']) ? mb_substr((string) $named['q'], 0, 100) : null,
            'status' => is_array($status) ? implode(',', array_map('strval', $status)) : (is_scalar($status) ? (string) $status : null),
            'source' => self::pick($named, 'source', ['store', 'landing']),
            'page_id' => self::pickId($named, 'page_id'),
            'product_id' => self::pickId($named, 'product_id'),
            'customer_id' => self::pickId($named, 'customer_id'),
            'shipping_company_id' => self::pickId($named, 'shipping_company_id'),
            'from' => isset($named['from']) && is_string($named['from']) ? $named['from'] : null,
            'to' => isset($named['to']) && is_string($named['to']) ? $named['to'] : null,
            'duplicate' => ! empty($named['duplicate']) ? '1' : null,
            'sort' => self::pick($named, 'sort', self::SORTS),
        ], fn ($v) => $v !== null && $v !== '');

        // The orders page's own filters, fed the same query string it gets.
        return OrderFilters::apply(Request::create('/', 'GET', array_map('strval', $params)));
    }

    public function with(): array
    {
        return ['items:id,order_id,product_name,quantity,is_gift'];
    }

    public function labelOf(Model $row): string
    {
        return 'طلب #'.$row->getAttribute('order_number');
    }

    public function url(?Model $row): ?string
    {
        return $row === null ? '/dashboard/orders' : "/dashboard/orders/{$row->getKey()}";
    }
}
