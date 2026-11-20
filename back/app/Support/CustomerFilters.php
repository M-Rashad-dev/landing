<?php

declare(strict_types=1);

namespace App\Support;

use App\Enums\BlockType;
use App\Enums\OrderStatus;
use App\Models\BlockedCustomer;
use App\Models\Customer;
use App\Services\PhoneNormalizer;
use Illuminate\Database\Eloquent\Builder;

/**
 * «العملاء» list filters shared by the dashboard and the store copilot: order stats per customer (delivered orders
 * count as spent; returned, damaged and fake as bad), search by name / phone, segments and sorts.
 */
final class CustomerFilters
{
    public const SEGMENTS = ['all', 'repeat', 'risky', 'blocked'];

    public const SORTS = ['latest', 'orders', 'spent', 'name'];

    /**
     * @param  array{q?: string|null, segment?: string|null, sort?: string|null}  $filters
     * @return Builder<Customer>
     */
    public static function apply(array $filters): Builder
    {
        $query = self::withStats(Customer::query());
        self::search($query, trim((string) ($filters['q'] ?? '')));
        self::segment($query, (string) ($filters['segment'] ?? 'all'));
        self::sort($query, (string) ($filters['sort'] ?? 'latest'));

        return $query;
    }

    /**
     * @param  Builder<Customer>  $query
     * @return Builder<Customer>
     */
    public static function withStats(Builder $query): Builder
    {
        return $query
            ->withCount([
                'orders',
                'orders as delivered_count' => fn ($q) => $q->where('status', OrderStatus::Delivered),
                'orders as open_count' => fn ($q) => $q->whereIn('status', [OrderStatus::New, OrderStatus::Confirmed, OrderStatus::Shipped]),
                'orders as bad_count' => fn ($q) => $q->whereIn('status', [OrderStatus::Returned, OrderStatus::Damaged, OrderStatus::Fake]),
            ])
            ->withSum(['orders as spent' => fn ($q) => $q->where('status', OrderStatus::Delivered)], 'total');
    }

    /** @param Builder<Customer> $query */
    public static function search(Builder $query, string $q): void
    {
        if ($q === '') {
            return;
        }
        $digits = (string) preg_replace('/\D+/', '', strtr($q, ['٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9']));
        $query->where(function (Builder $w) use ($q, $digits): void {
            $w->where('name', 'like', '%'.addcslashes($q, '%_\\').'%');
            if ($digits !== '') {
                $phone = app(PhoneNormalizer::class)->normalize($digits);
                $w->orWhere('phone', 'like', '%'.($phone !== null ? substr($phone, 3) : ltrim($digits, '0')).'%');
            }
        });
    }

    /** @param Builder<Customer> $query */
    public static function segment(Builder $query, string $segment): void
    {
        match ($segment) {
            'repeat' => $query->having('orders_count', '>=', 2),
            'risky' => $query->having('bad_count', '>', 0),
            'blocked' => $query->whereIn('phone', BlockedCustomer::query()->where('type', BlockType::Phone)->select('value')),
            default => null,
        };
    }

    /** @param Builder<Customer> $query */
    public static function sort(Builder $query, string $sort): void
    {
        match ($sort) {
            'orders' => $query->orderByDesc('orders_count')->orderByDesc('id'),
            'spent' => $query->orderByDesc('spent')->orderByDesc('id'),
            'name' => $query->orderBy('name')->orderBy('id'),
            default => $query->orderByDesc('last_order_at')->orderByDesc('id'),
        };
    }
}
