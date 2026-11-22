<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Ai\Copilot\Changes\ActionPreview;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Enums\DeliveryType;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\Order;
use App\Models\OrderDelivery;
use App\Store\Digital\DigitalDeliveries;

/** «تم التنفيذ» for a service order line the merchant did: the customer gets his message by email. */
final class OrdersDeliverService extends CopilotAction
{
    public function __construct(private readonly DigitalDeliveries $deliveries) {}

    public function key(): string
    {
        return 'orders.deliver_service';
    }

    public function label(): string
    {
        return 'تسليم خدمة (تم التنفيذ)';
    }

    public function summary(): string
    {
        return 'Mark a paid service order (a digital product delivered as a service: followers, a top-up…) as done and email the customer the merchant\'s message. message: what to tell him (default: the product\'s own message); subject optional. Only after the merchant says the service is done.';
    }

    public function available(CopilotContext $ctx): bool
    {
        return OrderDelivery::query()->where('type', DeliveryType::Services->value)->where('status', OrderDelivery::PENDING)->exists();
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => [
            'order_number' => ['type' => 'integer'],
            'message' => ['type' => 'string', 'description' => '≤ 3000 chars.'],
            'subject' => ['type' => 'string', 'description' => '≤ 150 chars.'],
        ], 'required' => ['order_number']];
    }

    public function approval(): bool
    {
        return true;
    }

    public function reversible(): bool
    {
        return false;
    }

    public function columns(): array
    {
        return ['message' => ['الرسالة', 'text']];
    }

    public function preview(array $args, CopilotContext $ctx): ActionPreview
    {
        $order = Order::query()->where('order_number', (int) ($args['order_number'] ?? 0))->first();
        $pending = $order === null ? collect() : OrderDelivery::query()->where('order_id', $order->id)->where('type', DeliveryType::Services->value)->where('status', OrderDelivery::PENDING)->with(['item', 'product'])->get();
        if ($pending->isEmpty()) {
            throw new CopilotToolError('That order has no service waiting to be delivered.');
        }

        $items = $pending->map(function (OrderDelivery $d) use ($args, $order): array {
            $settings = $d->product?->delivery_settings ?? [];
            $message = trim((string) ($args['message'] ?? '')) ?: strtr((string) (($settings['message'] ?? null) ?: __('digital.messages.services')), ['{name}' => $order->customer_name, '{order}' => (string) $order->order_number, '{product}' => (string) $d->item?->product_name, '{store}' => '']);

            return [
                'entity_type' => 'order_deliveries',
                'entity_id' => $d->id,
                'label' => 'طلب #'.$order->order_number.' · '.($d->item?->product_name ?? ''),
                'before' => [],
                'after' => ['message' => mb_substr($message, 0, 3000)],
                'status' => CopilotChangeItem::PENDING,
                'note' => null,
            ];
        })->values()->all();

        return new ActionPreview(
            summary: (string) __('ai.copilot.service_summary', ['number' => $order->order_number]),
            items: $items,
            sideEffects: [['key' => 'messages', 'count' => count($items), 'text' => (string) __('ai.copilot.orders_messages', ['count' => count($items)])]],
            spec: ['subject' => mb_substr(trim((string) ($args['subject'] ?? '')), 0, 150)],
        );
    }

    public function apply(CopilotChangeItem $item, CopilotChangeSet $set, CopilotContext $ctx): void
    {
        $delivery = OrderDelivery::query()->with('product')->findOrFail($item->entity_id);
        if ($delivery->status !== OrderDelivery::PENDING) {
            throw new CopilotToolError('Already delivered.');
        }
        $subject = (string) ($set->spec['subject'] ?? '') ?: (string) (($delivery->product?->delivery_settings['subject'] ?? null) ?: __('digital.subject'));
        $this->deliveries->completeService($delivery, $subject, (string) $item->after['message']);
    }
}
