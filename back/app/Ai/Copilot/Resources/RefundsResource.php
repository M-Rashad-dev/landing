<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Enums\RefundMethod;
use App\Enums\RefundStatus;
use App\Models\OrderRefund;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * «المرتجعات والمبالغ المسترجعة»: money sent back (or to send back) to customers, read only. The copilot never asks or
 * completes a refund: the money stays with the merchant (owner).
 */
final class RefundsResource extends CopilotResource
{
    public function key(): string
    {
        return 'refunds';
    }

    public function label(): string
    {
        return 'المبالغ المسترجعة';
    }

    public function summary(): string
    {
        return 'Refunds of orders (money sent back to customers): order number, amount in EGP, status (pending = to send back, done = sent, cancelled), method (the payment method used / wallet / InstaPay / bank / cash), reason, the returned items, whether the items went back to stock, dates (asked, done). Read only: refunds are made by the merchant on the order page.';
    }

    public function model(): string
    {
        return OrderRefund::class;
    }

    public function query(CopilotContext $ctx): Builder
    {
        return OrderRefund::query()->with('order:id,order_number,payment_method_name,payment_method', 'order.items:id,order_id,product_name');
    }

    public function fields(): array
    {
        return [
            Field::int('order_number')->label('رقم الطلب')->using(fn (Model $r) => $r instanceof OrderRefund ? $r->order?->order_number : null),
            Field::money('amount')->label('المبلغ')->filterable()->sortable(),
            Field::enum('status', RefundStatus::class)->label('الحالة')->filterable(),
            Field::enum('method', RefundMethod::class)->label('الطريقة')->filterable(),
            Field::text('reason')->label('السبب')->searchable(),
            Field::text('items')->label('المنتجات')->using(fn (Model $r) => $r instanceof OrderRefund ? array_map(
                fn (array $l) => ($r->order?->items->firstWhere('id', (int) $l['order_item_id'])?->product_name ?? '—').' × '.$l['quantity'],
                $r->items ?? [],
            ) : []),
            Field::bool('restock')->label('رجعت المخزون'),
            Field::text('destination')->label('اترجّع على')->hidden(),
            Field::date('done_at')->label('اترجّع في')->filterable()->sortable(),
            Field::date('created_at')->label('اتطلب في')->filterable()->sortable(),
        ];
    }

    public function labelOf(Model $row): string
    {
        return $row instanceof OrderRefund ? 'استرجاع طلب #'.($row->order?->order_number ?? '?') : parent::labelOf($row);
    }

    public function url(?Model $row): ?string
    {
        return $row instanceof OrderRefund ? '/dashboard/orders/'.$row->order_id : '/dashboard/orders/refunds';
    }
}
