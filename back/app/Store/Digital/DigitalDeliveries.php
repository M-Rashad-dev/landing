<?php

declare(strict_types=1);

namespace App\Store\Digital;

use App\Actions\Orders\ChangeOrderStatus;
use App\Enums\DeliveryType;
use App\Enums\MessagePurpose;
use App\Enums\OrderStatus;
use App\Mail\CustomerOrderMail;
use App\Mail\Store\StoreMailer;
use App\Messaging\WhatsApp\WhatsAppMessenger;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderDelivery;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductCode;
use App\Models\ProductFile;
use App\Models\Tenant;
use App\Notifications\StoreNotices;
use App\Services\PublicSite;
use App\Store\Payments\StorePayments;
use App\Store\ProductList;
use App\Store\Stock;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Delivering digital order lines once the payment is confirmed (inside the store's tenant, idempotent: one delivery
 * row per line). Files and links get a private token (downloads / opens counted per purchase), codes take the next
 * entries with uses left in the merchant's order, services wait for the merchant's «تم التنفيذ». Every delivery is
 * emailed with the product's message; an order with nothing else left becomes «تم التسليم» by itself.
 */
final class DigitalDeliveries
{
    public const DISK = 'local';

    public function __construct(
        private readonly StoreMailer $mailer,
        private readonly WhatsAppMessenger $messenger,
        private readonly StoreNotices $notices,
        private readonly Stock $stock,
    ) {}

    /** Delivers every digital line of a confirmed (paid) order that has nothing yet. */
    public function deliver(Order $order): void
    {
        $order->loadMissing('items');
        foreach ($order->items as $item) {
            if ($item->delivery_type === null || OrderDelivery::query()->where('order_item_id', $item->id)->exists()) {
                continue;
            }
            $product = Product::query()->withTrashed()->with('files')->find($item->product_id);
            if ($product === null || ! $product->isDigital()) {
                continue;
            }
            $delivery = $this->create($order, $item, $product);
            if ($delivery->status === OrderDelivery::DELIVERED) {
                $this->email($delivery);
            }
        }
        $this->completeIfDone($order);
    }

    /** Codes deliveries waiting for stock get theirs once the merchant adds entries (oldest order first). */
    public function fillWaiting(Product $product): int
    {
        $done = 0;
        OrderDelivery::query()->where('product_id', $product->id)->where('type', DeliveryType::Codes)->where('status', OrderDelivery::PENDING)
            ->orderBy('id')->get()->each(function (OrderDelivery $delivery) use ($product, &$done): void {
                $item = OrderItem::query()->find($delivery->order_item_id);
                $codes = $item === null ? null : $this->takeCodes($product, $this->keyOf($product, $item), $item->quantity);
                if ($codes === null) {
                    return;
                }
                $delivery->forceFill(['status' => OrderDelivery::DELIVERED, 'payload' => ['codes' => $codes], 'delivered_at' => now()])->save();
                $this->email($delivery);
                $this->completeIfDone(Order::query()->findOrFail($delivery->order_id));
                $done++;
            });

        return $done;
    }

    /** «تم التنفيذ»: the merchant did the service and sends his message (subject + text, the product's by default). */
    public function completeService(OrderDelivery $delivery, string $subject, string $message): OrderDelivery
    {
        $delivery->forceFill([
            'status' => OrderDelivery::DELIVERED,
            'payload' => ['subject' => mb_substr(trim(strip_tags($subject)), 0, 150), 'message' => mb_substr(trim(strip_tags($message)), 0, 3000)],
            'delivered_at' => now(),
        ])->save();
        $this->email($delivery);
        $this->completeIfDone(Order::query()->findOrFail($delivery->order_id));

        return $delivery;
    }

    /** «ابعت تاني»: the same delivery emailed again (never new codes). */
    public function resend(OrderDelivery $delivery): void
    {
        if ($delivery->status === OrderDelivery::DELIVERED) {
            $this->email($delivery);
        }
    }

    /** More downloads / opens for this purchase. */
    public function grant(OrderDelivery $delivery, int $count): OrderDelivery
    {
        $delivery->forceFill(['bonus' => min(1000, $delivery->bonus + max(1, $count))])->save();

        return $delivery;
    }

    /**
     * One download of a file (counted before it starts). Null when the downloads are used up.
     *
     * @return array{path: string, name: string, mime: string}|null
     */
    public function download(OrderDelivery $delivery, int $fileId): ?array
    {
        return DB::transaction(function () use ($delivery, $fileId): ?array {
            $locked = OrderDelivery::query()->whereKey($delivery->id)->lockForUpdate()->firstOrFail();
            $file = ProductFile::query()->where('product_id', $locked->product_id)->find($fileId);
            if ($file === null) {
                return null;
            }
            $left = $locked->left((string) $file->id);
            if ($left !== null && $left <= 0) {
                return null;
            }
            $usage = $locked->usage ?? [];
            $usage[(string) $file->id] = (int) ($usage[(string) $file->id] ?? 0) + 1;
            $locked->forceFill(['usage' => $usage])->save();
            $ext = pathinfo($file->original_name, PATHINFO_EXTENSION);
            $name = $file->name.($ext !== '' && ! str_ends_with(mb_strtolower($file->name), '.'.mb_strtolower($ext)) ? '.'.$ext : '');

            return ['path' => Storage::disk(self::DISK)->path($file->path), 'name' => $name, 'mime' => $file->mime];
        });
    }

    /** One open of the link (counted). Null when the opens are used up. */
    public function open(OrderDelivery $delivery): ?string
    {
        return DB::transaction(function () use ($delivery): ?string {
            $locked = OrderDelivery::query()->whereKey($delivery->id)->lockForUpdate()->firstOrFail();
            $link = $locked->payload['link'] ?? null;
            $left = $locked->left('link');
            if (! is_string($link) || ($left !== null && $left <= 0)) {
                return null;
            }
            $usage = $locked->usage ?? [];
            $usage['link'] = (int) ($usage['link'] ?? 0) + 1;
            $locked->forceFill(['usage' => $usage])->save();

            return $link;
        });
    }

    /** What the customer sees on his order page (codes and message only once delivered). @return list<array<string, mixed>> */
    public function customerView(Order $order, string $host): array
    {
        $base = rtrim(PublicSite::url($host), '/');

        return OrderDelivery::query()->where('order_id', $order->id)->with(['item', 'product.files'])->orderBy('id')->get()
            ->map(function (OrderDelivery $d) use ($base): array {
                $done = $d->status === OrderDelivery::DELIVERED;

                return [
                    'product' => $d->item?->product_name,
                    'type' => $d->type->value,
                    'status' => $d->status,
                    'message' => $done ? $this->message($d) : null,
                    'files' => $done && $d->type === DeliveryType::Files ? ($d->product?->files ?? collect())->map(fn (ProductFile $f) => [
                        'id' => $f->id,
                        'name' => $f->name,
                        'size' => $f->size,
                        'left' => $d->left((string) $f->id),
                        'url' => $base.'/api/public/downloads/'.$d->token.'/'.$f->id,
                    ])->values()->all() : [],
                    'codes' => $done && $d->type === DeliveryType::Codes ? array_values($d->payload['codes'] ?? []) : [],
                    'link' => $done && $d->type === DeliveryType::Links ? ['url' => $base.'/api/public/open/'.$d->token, 'left' => $d->left('link')] : null,
                ];
            })->values()->all();
    }

    /** The order is «تم التسليم» once every line is delivered and nothing physical is left to ship. */
    public function completeIfDone(Order $order): void
    {
        $order->loadMissing('items');
        if ($order->status !== OrderStatus::Confirmed || $order->items->contains(fn (OrderItem $i) => $i->delivery_type === null)) {
            return;
        }
        $pending = OrderDelivery::query()->where('order_id', $order->id)->where('status', OrderDelivery::DELIVERED)->count() < $order->items->count();
        if (! $pending) {
            app(ChangeOrderStatus::class)->handle($order, OrderStatus::Delivered, (string) __('digital.delivered_note'), null, ['notify' => false]);
        }
    }

    private function create(Order $order, OrderItem $item, Product $product): OrderDelivery
    {
        $settings = $product->delivery_settings ?? [];
        $row = [
            'order_id' => $order->id,
            'order_item_id' => $item->id,
            'product_id' => $product->id,
            'type' => $product->delivery_type,
            'status' => OrderDelivery::DELIVERED,
            'token' => Str::lower(Str::random(40)),
            'delivered_at' => now(),
        ];

        return match ($product->delivery_type) {
            DeliveryType::Files => OrderDelivery::query()->create($row + ['limit' => isset($settings['downloads']) ? (int) $settings['downloads'] : null]),
            DeliveryType::Links => OrderDelivery::query()->create($row + ['payload' => ['link' => (string) ($settings['link'] ?? '')], 'limit' => isset($settings['opens']) ? (int) $settings['opens'] : null]),
            DeliveryType::Services => OrderDelivery::query()->create(['status' => OrderDelivery::PENDING, 'delivered_at' => null] + $row),
            DeliveryType::Codes => $this->createCodes($row, $product, $item),
            default => throw new \LogicException('No delivery type'),
        };
    }

    /** @param array<string, mixed> $row */
    private function createCodes(array $row, Product $product, OrderItem $item): OrderDelivery
    {
        $codes = $this->takeCodes($product, $this->keyOf($product, $item), $item->quantity);
        if ($codes === null) {
            $this->notices->codesOut($item->tenant_id, $product->id, $product->name);

            return OrderDelivery::query()->create(['status' => OrderDelivery::PENDING, 'delivered_at' => null] + $row);
        }

        return OrderDelivery::query()->create($row + ['payload' => ['codes' => $codes]]);
    }

    /**
     * The next entries with uses left, one per unit (never the same entry twice in one purchase), in the merchant's
     * order. Null when there aren't enough (nothing is taken then).
     *
     * @return list<string>|null
     */
    public function takeCodes(Product $product, string $key, int $quantity): ?array
    {
        $taken = DB::transaction(function () use ($product, $key, $quantity): ?array {
            $rows = ProductCode::query()->where('product_id', $product->id)->where('combination_key', $key)->where('uses_left', '>', 0)
                ->orderBy('position')->orderBy('id')->limit($quantity)->lockForUpdate()->get();
            if ($rows->count() < $quantity) {
                return null;
            }
            foreach ($rows as $row) {
                ProductCode::query()->whereKey($row->id)->toBase()->decrement('uses_left');
            }

            return $rows->map(fn (ProductCode $c) => $c->code)->values()->all();
        });

        if ($taken !== null) {
            $left = $this->stock->codesLeft($product, $key);
            $mark = $product->low_stock_threshold ?? ProductList::LOW_STOCK_DEFAULT;
            if ($left + $quantity > $mark && $left <= $mark) {
                $this->notices->lowStock($product->tenant_id, $product->id, $product->name, $left);
            }
        }

        return $taken;
    }

    /** The option combination a line bought (codes are kept per combination). */
    private function keyOf(Product $product, OrderItem $item): string
    {
        $product->loadMissing('options.values');
        $selected = [];
        foreach ($item->options ?? [] as $entry) {
            if (isset($entry['kind'])) {
                continue;
            }
            $option = $product->options->first(fn ($o) => $o->name === ($entry['option'] ?? null));
            $value = $option?->values->first(fn ($v) => $v->label === ($entry['value'] ?? null));
            if ($option !== null && $value !== null) {
                $selected[] = ['option_id' => $option->id, 'value_id' => $value->id];
            }
        }

        return $this->stock->keyFor($product, $selected);
    }

    /** The product's message (or the service's own) with {name} {order} {product} {store} filled in. */
    private function message(OrderDelivery $delivery): string
    {
        if ($delivery->type === DeliveryType::Services && isset($delivery->payload['message'])) {
            return (string) $delivery->payload['message'];
        }
        $settings = $delivery->product?->delivery_settings ?? [];

        return $this->fill((string) (($settings['message'] ?? null) ?: __('digital.messages.'.$delivery->type->value)), $delivery);
    }

    private function subject(OrderDelivery $delivery): string
    {
        if ($delivery->type === DeliveryType::Services && isset($delivery->payload['subject']) && $delivery->payload['subject'] !== '') {
            return (string) $delivery->payload['subject'];
        }
        $settings = $delivery->product?->delivery_settings ?? [];

        return $this->fill((string) (($settings['subject'] ?? null) ?: __('digital.subject')), $delivery);
    }

    private function fill(string $text, OrderDelivery $delivery): string
    {
        $order = $delivery->order ?? Order::query()->find($delivery->order_id);

        return strtr($text, [
            '{name}' => (string) ($order?->customer_name ?? ''),
            '{order}' => (string) ($order?->order_number ?? ''),
            '{product}' => (string) ($delivery->item?->product_name ?? ''),
            '{store}' => (string) Tenant::query()->whereKey($delivery->tenant_id)->value('name'),
        ]);
    }

    /** The delivery email (the store's mailbox when it has one), logged on the order. */
    private function email(OrderDelivery $delivery): void
    {
        $order = Order::query()->find($delivery->order_id);
        $email = $order?->customer_email ?: ($order?->customer_id ? Customer::query()->whereKey($order->customer_id)->value('email') : null);
        if ($order === null || ! is_string($email) || $email === '') {
            return;
        }
        $store = (string) Tenant::query()->whereKey($delivery->tenant_id)->value('name');
        $rows = [['label' => (string) __('digital.product'), 'value' => (string) ($delivery->item?->product_name ?? '')]];
        foreach ($delivery->payload['codes'] ?? [] as $i => $code) {
            $rows[] = ['label' => (string) __('digital.code', ['n' => $i + 1]), 'value' => (string) $code];
        }

        try {
            $via = $this->mailer->send($delivery->tenant_id, $email, new CustomerOrderMail(
                'digital_delivery',
                $store,
                $this->subject($delivery),
                $this->message($delivery),
                $rows,
                (string) __('digital.open'),
                StorePayments::payUrl($order),
                (string) __('customer_notices.footer', ['store' => $store]),
            ));
            $this->messenger->logEmail($email, MessagePurpose::OrderDigitalDelivery, $delivery->tenant_id, $order->id, $via->value);
            $delivery->forceFill(['emailed_at' => now()])->save();
        } catch (Throwable $e) {
            report($e);
        }
    }
}
