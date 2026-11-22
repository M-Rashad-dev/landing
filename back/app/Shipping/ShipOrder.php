<?php

declare(strict_types=1);

namespace App\Shipping;

use App\Enums\OrderStatus;
use App\Enums\ShipmentState;
use App\Exceptions\ApiException;
use App\Models\CarrierAccount;
use App\Models\Media;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Shipment;
use App\Services\PublicSite;
use App\Shipping\Carriers\CarrierError;
use App\Shipping\Carriers\Carriers;
use App\Shipping\Carriers\ShipmentDraft;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

/**
 * Sends one confirmed order through a connected carrier: the customer's area (matched from the city text, or the one
 * the merchant picked), the cash to collect (the order total unless changed), the items, the account's settings.
 * The order keeps «مؤكد» until the courier picks it up; the tracking number is saved on it at once.
 */
final class ShipOrder
{
    /** The most a shipment may collect, in cents (Bosta's own limit). */
    public const MAX_COD = 3_000_000;

    public function __construct(private readonly Carriers $carriers) {}

    /**
     * @param  array{district_id?: string|null, cod?: int|null, items_count?: int|null, notes?: string|null, allow_open?: bool|null}  $input  cod in cents
     */
    public function handle(Order $order, CarrierAccount $account, array $input, ?int $userId): Shipment
    {
        $carrier = $this->carriers->get($account->carrier);
        if (! $account->isActive()) {
            throw new ApiException(422, 'carrier_failed', (string) __('shipping.carriers.failed', ['carrier' => $carrier->label()]));
        }

        return DB::transaction(function () use ($order, $account, $input, $userId, $carrier): Shipment {
            /** @var Order $locked */
            $locked = Order::query()->with(['items', 'product'])->whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== OrderStatus::Confirmed) {
                throw new ApiException(422, 'ship_not_confirmed', (string) __('shipping.ship.not_confirmed'));
            }
            $open = Shipment::query()->where('order_id', $locked->id)->where('is_open', true)->first();
            if ($open !== null) {
                throw new ApiException(409, 'ship_exists', (string) __('shipping.ship.exists', ['tracking' => $open->tracking_number]));
            }
            $governorate = trim((string) $locked->governorate);
            if ($governorate === '') {
                throw new ApiException(422, 'ship_no_governorate', (string) __('shipping.ship.no_governorate'));
            }
            $address = trim(implode('، ', array_filter([trim((string) $locked->address), trim((string) $locked->city)])));
            if (mb_strlen(trim((string) $locked->address)) < 6) {
                throw new ApiException(422, 'ship_address_short', (string) __('shipping.ship.address_short'));
            }
            $cod = $input['cod'] ?? Money::toCents((string) $locked->total);
            if ($cod < 0 || $cod > self::MAX_COD) {
                throw new ApiException(422, 'ship_cod', (string) __('shipping.ship.cod_limit', ['max' => number_format(self::MAX_COD / 100)]));
            }

            try {
                $district = ($input['district_id'] ?? null) ?: $carrier->matchDistrict($governorate, $locked->city);
                if ($district === null) {
                    throw new ApiException(422, 'ship_district_needed', (string) __('shipping.ship.district_needed', ['carrier' => $carrier->label()]));
                }
                $allowOpen = (bool) ($input['allow_open'] ?? $account->setting('allow_open', false));
                $made = $carrier->create($account, new ShipmentDraft(
                    reference: (string) $locked->order_number,
                    receiverName: trim((string) $locked->customer_name) ?: (string) $locked->customer_phone,
                    phone: (string) $locked->customer_phone,
                    phone2: $locked->customer_phone2 ?: null,
                    email: $locked->customer_email ?: null,
                    governorate: $governorate,
                    city: $locked->city,
                    address: $address,
                    districtId: (string) $district,
                    cod: $cod,
                    itemsCount: max(1, (int) ($input['items_count'] ?? $this->itemsCount($locked))),
                    description: $this->description($locked),
                    notes: $this->notes($input['notes'] ?? null, $locked, $account),
                    allowOpen: $allowOpen,
                    images: $allowOpen ? $this->photos($locked) : [],
                    locationId: $account->setting('location_id'),
                    packageType: (string) $account->setting('package_type', 'Parcel'),
                    size: (string) $account->setting('size', 'SMALL'),
                    webhookUrl: self::webhookUrl($account),
                    webhookSecret: $account->webhook_secret,
                ));
            } catch (CarrierError $e) {
                if ($e->auth) {
                    $account->forceFill(['status' => CarrierAccount::FAILED, 'last_error' => mb_substr($e->getMessage(), 0, 300), 'checked_at' => now()])->save();
                }
                throw new ApiException(422, $e->auth ? 'carrier_auth' : 'carrier_refused', $e->getMessage());
            }

            $state = $made->update->state ?? ShipmentState::Created;
            $shipment = Shipment::query()->create([
                'order_id' => $locked->id,
                'carrier_account_id' => $account->id,
                'carrier' => $account->carrier,
                'external_id' => $made->externalId,
                'tracking_number' => mb_substr($made->trackingNumber, 0, 60),
                'state' => $state,
                'carrier_code' => $made->update->code,
                'carrier_label' => $made->update->label === null ? null : mb_substr($made->update->label, 0, 80),
                'cod' => Money::toDecimal($cod),
                'is_open' => $state->isOpen(),
                'created_by' => $userId,
                'synced_at' => now(),
            ]);
            $shipment->events()->create(['state' => $state, 'carrier_code' => $made->update->code, 'label' => $made->update->label, 'happened_at' => $made->update->at]);
            $locked->forceFill(['tracking_number' => $shipment->tracking_number])->save();

            return $shipment;
        });
    }

    /** Where the carrier posts this account's status updates (Next relays it to Laravel). */
    public static function webhookUrl(CarrierAccount $account): string
    {
        return PublicSite::url((string) config('landing.app_host')).'api/webhooks/shipping/'.$account->carrier.'/'.$account->webhook_token;
    }

    private function itemsCount(Order $order): int
    {
        return $order->items->isNotEmpty() ? (int) $order->items->sum('quantity') : (int) ($order->quantity ?: 1);
    }

    /** «2 × تيشيرت أسود، 1 × كاب» (what the courier reads). */
    private function description(Order $order): string
    {
        if ($order->items->isNotEmpty()) {
            return implode('، ', $order->items->map(fn (OrderItem $i) => $i->quantity.' × '.$i->product_name)->all());
        }

        return ((int) ($order->quantity ?: 1)).' × '.($order->product instanceof Product ? $order->product->name : (string) $order->order_number);
    }

    private function notes(?string $typed, Order $order, CarrierAccount $account): ?string
    {
        $parts = array_filter([trim((string) $typed), trim((string) $account->setting('notes', '')), trim((string) $order->notes)]);

        return $parts === [] ? null : mb_substr(implode(' — ', array_unique($parts)), 0, 300);
    }

    /** @return list<string> absolute URLs of the products' first photos (opening the package needs them) */
    private function photos(Order $order): array
    {
        $ids = $order->items->isNotEmpty() ? $order->items->pluck('product_id')->filter()->unique()->all() : array_filter([$order->product_id]);
        $base = rtrim(PublicSite::url((string) config('landing.app_host')), '/');

        return Product::query()->withTrashed()->with('media')->whereKey($ids)->get()
            ->map(fn (Product $p) => $p->media->first())
            ->filter(fn ($m) => $m instanceof Media)
            ->map(fn (Media $m) => $base.Media::url($m->variants['large'] ?? $m->path))
            ->take(10)->values()->all();
    }
}
