<?php

declare(strict_types=1);

namespace App\Support;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Services\PhoneNormalizer;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Dashboard order filters shared by the list, the export and the counters:
 * status, q (name / phone / order number), page_id, product_id, from/to (Cairo dates), duplicate, sort.
 */
final class OrderFilters
{
    /** @return Builder<Order> */
    public static function apply(Request $request, bool $withStatus = true): Builder
    {
        $query = Order::query();

        $status = (string) $request->query('status', '');
        if ($withStatus && in_array($status, OrderStatus::values(), true)) {
            $query->where('status', $status);
        }

        $q = trim((string) $request->query('q', ''));
        if ($q !== '') {
            $query->where(function (Builder $w) use ($q): void {
                $w->where('customer_name', 'like', '%'.addcslashes($q, '%_\\').'%');

                $digits = (string) preg_replace('/\D+/', '', strtr($q, ['٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9']));
                if ($digits !== '') {
                    $phone = app(PhoneNormalizer::class)->normalize($digits);
                    // Local "010…" input matches the stored "+2010…".
                    $w->orWhere('customer_phone', 'like', '%'.($phone !== null ? substr($phone, 3) : ltrim($digits, '0')).'%');
                    if (strlen($digits) <= 9) {
                        $w->orWhere('order_number', (int) $digits);
                    }
                }
            });
        }

        foreach (['page_id' => 'landing_page_id', 'product_id' => 'product_id'] as $param => $column) {
            $id = $request->query($param);
            if (is_string($id) && ctype_digit($id)) {
                $query->where($column, (int) $id);
            }
        }

        $from = self::cairoDate($request->query('from'));
        if ($from !== null) {
            $query->where('created_at', '>=', $from->startOfDay()->utc());
        }
        $to = self::cairoDate($request->query('to'));
        if ($to !== null) {
            $query->where('created_at', '<=', $to->endOfDay()->utc());
        }

        if ($request->boolean('duplicate')) {
            $query->where('is_duplicate_suspect', true);
        }

        match ((string) $request->query('sort', 'latest')) {
            'oldest' => $query->orderBy('id'),
            'total_desc' => $query->orderByDesc('total')->orderByDesc('id'),
            'total_asc' => $query->orderBy('total')->orderByDesc('id'),
            default => $query->orderByDesc('id'),
        };

        return $query;
    }

    private static function cairoDate(mixed $value): ?CarbonImmutable
    {
        if (! is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) !== 1) {
            return null;
        }

        try {
            return CarbonImmutable::createFromFormat('Y-m-d', $value, (string) config('landing.display_timezone'));
        } catch (\Throwable) {
            return null;
        }
    }
}
