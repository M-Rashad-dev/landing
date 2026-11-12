<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\Identity;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusLog;
use App\Services\PhoneNormalizer;
use App\Services\PublicPageData;
use App\Services\PublicSite;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Customer order tracking on the store's site (/track): order number + phone must match.
 * Only what the customer needs: stage, items, total and dates (no internal notes or states).
 */
final class TrackController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly PublicSite $site, private readonly PublicPageData $data) {}

    /** Store look for the tracking page: the default identity and the home page slug. */
    public function brand(Request $request): JsonResponse
    {
        $domain = $this->site->activeDomainOrFail((string) $request->query('host', ''));

        return Tenancy::runAs($domain->tenant_id, function () {
            $identity = Identity::query()->where('is_default', true)->first() ?? Identity::query()->first();

            return $this->ok([
                'identity' => $identity === null ? null : $this->data->identity($identity),
                'home_slug' => $this->site->homeSlug(),
            ]);
        });
    }

    public function show(Request $request, PhoneNormalizer $phones): JsonResponse
    {
        $data = $request->validate([
            'host' => ['required', 'string', 'max:253'],
            'order_number' => ['required', 'integer', 'min:1', 'max:999999999'],
            'phone' => ['required', 'string', 'max:30'],
            'ip' => ['nullable', 'ip'],
        ]);
        $domain = $this->site->activeDomainOrFail($data['host']);
        $phone = $phones->normalize($data['phone']);

        $order = $phone === null ? null : Tenancy::runAs($domain->tenant_id, fn () => Order::query()
            ->with(['items', 'logs'])
            ->where('order_number', (int) $data['order_number'])
            ->where(fn ($q) => $q->where('customer_phone', $phone)->orWhere('customer_phone2', $phone))
            ->first());

        // Same answer for a wrong number and a wrong phone.
        if ($order === null) {
            throw new ApiException(404, 'order_not_found', __('orders.track_not_found'));
        }

        $history = [];
        foreach ($order->logs as $log) {
            /** @var OrderStatusLog $log */
            $stage = self::legacyStage($log->to_status->customerStage());
            if (($history[array_key_last($history) ?? -1]['stage'] ?? null) !== $stage) {
                $history[] = ['stage' => $stage, 'at' => $log->created_at->toIso8601ZuluString()];
            }
        }

        return $this->ok([
            'order_number' => $order->order_number,
            'stage' => self::legacyStage($order->status->customerStage()),
            'created_at' => $order->created_at->toIso8601ZuluString(),
            'items' => $order->items->map(fn (OrderItem $item) => [
                'name' => $item->product_name,
                'quantity' => $item->quantity,
                'options' => array_values(array_map(fn ($o) => (string) ($o['value'] ?? ''), $item->options ?? [])),
            ])->values()->all(),
            'total' => Money::toFloat(Money::toCents((string) $order->total)),
            'governorate' => $order->governorate,
            'history' => $history,
        ])->header('Cache-Control', 'no-store, private');
    }

    /** The current storefront shows three steps (received, confirmed, delivered): shipped reads as confirmed there. */
    private static function legacyStage(string $stage): string
    {
        return $stage === 'shipped' ? 'confirmed' : $stage;
    }
}
