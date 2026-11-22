<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Actions\Orders\ChangeOrderStatus;
use App\Ai\Copilot\Changes\ActionPreview;
use App\Ai\Copilot\Changes\Selector;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotCatalog;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Enums\OrderStatus;
use App\Enums\WebhookEvent;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\Order;
use App\Models\Webhook;

/**
 * Changes the status of many orders (confirm the new ones, mark shipped…), each through the orders page's own
 * ChangeOrderStatus: allowed transitions only, status log, restock, customer messages, webhooks. The preview counts
 * those side effects; there is no undo (messages go out, webhooks fire).
 */
final class OrdersChangeStatus extends CopilotAction
{
    public const MAX = 500;

    /** Statuses that send the customer a message (CustomerNotices::statusChanged). */
    private const MESSAGED = [OrderStatus::Shipped, OrderStatus::Cancelled, OrderStatus::Delivered];

    public function __construct(private readonly CopilotCatalog $catalog, private readonly ChangeOrderStatus $change) {}

    public function key(): string
    {
        return 'orders.change_status';
    }

    public function label(): string
    {
        return 'تغيير حالة الطلبات';
    }

    public function summary(): string
    {
        return 'Change the status of up to 500 orders at once (e.g. confirm the new ones of a governorate, mark confirmed as shipped). Only allowed transitions; customer messages and webhooks go out as on the orders page.';
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => [
            'selector' => ['type' => 'object', 'description' => 'Like update_records on orders: {"ids"} | {"filters"} (e.g. {"status": ["new"], "governorate": "القاهرة"}) | {"context": "selection"}.'],
            'to' => ['type' => 'string', 'enum' => OrderStatus::values()],
            'note' => ['type' => 'string', 'description' => 'Optional note for the status log, ≤ 500 chars.'],
        ], 'required' => ['selector', 'to']];
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
        $labels = [];
        foreach (OrderStatus::cases() as $status) {
            $labels[$status->value] = $status->label();
        }

        return ['status' => ['الحالة', 'text', $labels]];
    }

    public function preview(array $args, CopilotContext $ctx): ActionPreview
    {
        $to = OrderStatus::tryFrom((string) ($args['to'] ?? '')) ?? throw new CopilotToolError('to is one of: '.implode(', ', OrderStatus::values()).'.');
        $resource = $this->catalog->resource('orders', $ctx) ?? throw new CopilotToolError('Orders are not available.');
        $ids = Selector::ids($resource, is_array($args['selector'] ?? null) ? $args['selector'] : [], $ctx);
        if (count($ids) > self::MAX) {
            throw new CopilotToolError('That is '.count($ids).' orders; one change holds at most '.self::MAX.'. Narrow the filters.');
        }
        $orders = Order::query()->whereKey($ids)->orderBy('order_number')->get(['id', 'order_number', 'status']);

        $items = [];
        foreach ($orders as $order) {
            // Confirming an order that waits for its payment says the money arrived: the merchant does that himself.
            $payment = $order->status === OrderStatus::AwaitingPayment && $to === OrderStatus::Confirmed;
            $allowed = ! $payment && $order->status->canTransitionTo($to);
            $items[] = [
                'entity_type' => 'orders',
                'entity_id' => $order->id,
                'label' => 'طلب #'.$order->order_number,
                'before' => ['status' => $order->status->value],
                'after' => ['status' => $to->value],
                'status' => $allowed ? CopilotChangeItem::PENDING : CopilotChangeItem::SKIPPED_INVALID,
                'note' => $allowed ? null : ($payment ? (string) __('ai.copilot.payment_by_merchant') : (string) __('orders.transition_not_allowed', ['from' => $order->status->label(), 'to' => $to->label()])),
            ];
        }
        $count = count(array_filter($items, fn (array $i) => $i['status'] === CopilotChangeItem::PENDING));

        $effects = [];
        if (in_array($to, self::MESSAGED, true) && $count > 0) {
            $effects[] = ['key' => 'messages', 'count' => $count, 'text' => (string) __('ai.copilot.orders_messages', ['count' => $count])];
        }
        $hooks = Webhook::query()->where('is_active', true)->servable()->whereJsonContains('events', WebhookEvent::OrderStatusChanged->value)->count();
        if ($hooks > 0 && $count > 0) {
            $effects[] = ['key' => 'webhooks', 'count' => $count * $hooks, 'text' => (string) __('ai.copilot.orders_webhooks', ['count' => $count * $hooks])];
        }
        if ($to->restocks() && $count > 0) {
            $effects[] = ['key' => 'restock', 'count' => $count, 'text' => (string) __('ai.copilot.orders_restock')];
        }

        return new ActionPreview(
            summary: (string) __('ai.copilot.orders_summary', ['count' => $count, 'status' => $to->label()]),
            items: $items,
            sideEffects: $effects,
            spec: ['to' => $to->value, 'note' => mb_substr(trim((string) ($args['note'] ?? '')), 0, 500)],
        );
    }

    public function current(CopilotChangeItem $item, CopilotContext $ctx): ?array
    {
        $status = Order::query()->whereKey($item->entity_id)->value('status');

        return ['status' => $status instanceof OrderStatus ? $status->value : (string) $status];
    }

    public function apply(CopilotChangeItem $item, CopilotChangeSet $set, CopilotContext $ctx): void
    {
        $order = Order::query()->findOrFail($item->entity_id);
        if ($order->status === OrderStatus::AwaitingPayment && (string) $set->spec['to'] === OrderStatus::Confirmed->value) {
            throw new CopilotToolError((string) __('ai.copilot.payment_by_merchant'));
        }
        $note = (string) ($set->spec['note'] ?? '');
        $this->change->handle($order, OrderStatus::from((string) $set->spec['to']), $note !== '' ? $note : null, $ctx->user?->id);
    }
}
