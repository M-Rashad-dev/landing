<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Billing\PlanCatalog;
use App\Enums\NotificationEvent;
use App\Models\Domain;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\ProductImport;
use App\Models\Shipment;
use App\Models\SupportTicket;
use App\Models\Tenant;
use App\Support\CairoTime;
use App\Support\Money;
use Carbon\CarbonInterface;

/** What a store owner is told, written once here (bell + email + the WhatsApp template values). */
final class StoreNotices
{
    public function __construct(
        private readonly NotificationCenter $center,
        private readonly PlanCatalog $plans,
    ) {}

    public function newOrder(Order $order): void
    {
        $total = Money::toCents((string) $order->total);
        $customer = (string) ($order->customer_name ?: $order->customer_phone);

        $this->center->toStore($order->tenant_id, new Notice(
            NotificationEvent::NewOrder,
            __('notifications.new_order.title', ['number' => $order->order_number]),
            __('notifications.new_order.body', ['customer' => $customer, 'total' => $this->money($total)]),
            '/dashboard/orders/'.$order->id,
            array_values(array_filter([
                ['label' => __('notifications.new_order.number'), 'value' => '#'.$order->order_number],
                ['label' => __('notifications.new_order.customer'), 'value' => $customer],
                ['label' => __('notifications.new_order.total'), 'value' => $this->money($total)],
                $order->governorate ? ['label' => __('notifications.new_order.place'), 'value' => (string) $order->governorate] : null,
            ])),
            __('notifications.new_order.action'),
            'merchant_new_order',
            [(string) $order->order_number, $this->store($order->tenant_id), $this->plain($total)],
            (string) $order->id,
        ));
    }

    /** A product (or one of its options) went down to its low-stock mark with this order. */
    public function lowStock(int $tenantId, int $productId, string $product, int $left): void
    {
        $this->center->toStore($tenantId, new Notice(
            NotificationEvent::LowStock,
            __('notifications.low_stock.title', ['product' => $product]),
            __('notifications.low_stock.body', ['product' => $product, 'left' => max(0, $left)]),
            '/dashboard/catalog/products/'.$productId,
            [
                ['label' => __('notifications.low_stock.product'), 'value' => $product],
                ['label' => __('notifications.low_stock.left'), 'value' => (string) max(0, $left)],
            ],
            __('notifications.low_stock.action'),
            'merchant_low_stock',
            [(string) max(0, $left), $product, $this->store($tenantId)],
        ));
    }

    public function planExpiring(Tenant $tenant, int $days, CarbonInterface $endsAt): void
    {
        $plan = (string) ($this->plans->plan($tenant->plan_key)['name'] ?? $tenant->plan_key);
        $date = $this->date($endsAt);

        $this->center->toStore($tenant->id, new Notice(
            NotificationEvent::PlanExpiring,
            __('notifications.plan_expiring.title', ['days' => trans_choice('notifications.plan_expiring.days', $days, ['count' => $days])]),
            __('notifications.plan_expiring.body', ['plan' => $plan, 'date' => $date]),
            '/dashboard/settings/billing',
            [
                ['label' => __('notifications.plan_expiring.plan'), 'value' => $plan],
                ['label' => __('notifications.plan_expiring.ends'), 'value' => $date],
            ],
            __('notifications.plan_expiring.action'),
            'plan_expiring',
            [$plan, $tenant->name, $date],
            dedupeKey: 'plan_expiring:'.$endsAt->getTimestamp().':'.$days,
        ));
    }

    public function planExpired(Tenant $tenant, CarbonInterface $endedAt): void
    {
        $this->center->toStore($tenant->id, new Notice(
            NotificationEvent::PlanExpired,
            __('notifications.plan_expired.title'),
            __('notifications.plan_expired.body'),
            '/dashboard/settings/billing',
            [],
            __('notifications.plan_expired.action'),
            'plan_expired',
            [$tenant->name],
            dedupeKey: 'plan_expired:'.$endedAt->getTimestamp(),
        ));
    }

    public function receiptApproved(Invoice $invoice): void
    {
        $this->center->toStore($invoice->tenant_id, new Notice(
            NotificationEvent::ReceiptApproved,
            __('notifications.receipt_approved.title'),
            __('notifications.receipt_approved.body', ['invoice' => $invoice->number]),
            '/dashboard/settings/billing',
            [
                ['label' => __('notifications.receipt_approved.invoice'), 'value' => (string) $invoice->number],
                ['label' => __('notifications.receipt_approved.amount'), 'value' => $this->money(Money::toCents((string) $invoice->total))],
            ],
            __('notifications.receipt_approved.action'),
            'receipt_approved',
            [(string) $invoice->number],
        ));
    }

    public function receiptRejected(Invoice $invoice, string $reason): void
    {
        $this->center->toStore($invoice->tenant_id, new Notice(
            NotificationEvent::ReceiptRejected,
            __('notifications.receipt_rejected.title'),
            __('notifications.receipt_rejected.body', ['invoice' => $invoice->number, 'reason' => $reason]),
            '/dashboard/settings/billing',
            [
                ['label' => __('notifications.receipt_rejected.invoice'), 'value' => (string) $invoice->number],
                ['label' => __('notifications.receipt_rejected.reason'), 'value' => $reason],
            ],
            __('notifications.receipt_rejected.action'),
            'receipt_rejected',
            [(string) $invoice->number, $reason],
        ));
    }

    public function supportReply(SupportTicket $ticket): void
    {
        $this->center->toStore($ticket->tenant_id, new Notice(
            NotificationEvent::SupportReply,
            __('notifications.support_reply.title'),
            __('notifications.support_reply.body', ['number' => $ticket->number]),
            '/dashboard?support='.$ticket->number,
            [],
            __('notifications.support_reply.action'),
            'merchant_support_reply',
            [(string) $ticket->number],
        ));
    }

    public function domainReady(Domain $domain): void
    {
        $this->center->toStore($domain->tenant_id, new Notice(
            NotificationEvent::DomainReady,
            __('notifications.domain_ready.title'),
            __('notifications.domain_ready.body', ['host' => $domain->host]),
            '/dashboard/settings/domains',
            [],
            __('notifications.domain_ready.action'),
            'merchant_domain_ready',
            [$domain->host, $this->store($domain->tenant_id)],
            dedupeKey: 'domain_ready:'.$domain->id,
        ));
    }

    public function importDone(ProductImport $import): void
    {
        $failed = $import->failed_count + $import->skipped_count;

        $this->center->toStore($import->tenant_id, new Notice(
            NotificationEvent::ImportDone,
            __('notifications.import_done.title'),
            __('notifications.import_done.body', ['created' => $import->created_count, 'updated' => $import->updated_count, 'failed' => $failed]),
            '/dashboard/catalog/products/import',
            [
                ['label' => __('notifications.import_done.created'), 'value' => (string) $import->created_count],
                ['label' => __('notifications.import_done.updated'), 'value' => (string) $import->updated_count],
                ['label' => __('notifications.import_done.failed'), 'value' => (string) $failed],
            ],
            __('notifications.import_done.action'),
            'merchant_import_done',
            [$this->store($import->tenant_id), (string) ($import->created_count + $import->updated_count), (string) $failed],
            dedupeKey: 'import_done:'.$import->id,
        ));
    }

    /** A shipment the merchant should look at (bell + email; no WhatsApp template yet). */
    public function shipmentProblem(Shipment $shipment, string $carrier): void
    {
        $number = (string) Order::query()->whereKey($shipment->order_id)->value('order_number');

        $this->center->toStore($shipment->tenant_id, new Notice(
            NotificationEvent::ShipmentProblem,
            __('notifications.shipment_problem.title', ['number' => $number, 'state' => $shipment->state->label()]),
            __('notifications.shipment_problem.body', ['carrier' => $carrier, 'state' => $shipment->state->label(), 'reason' => $shipment->exception ?? $shipment->carrier_label ?? '—']),
            '/dashboard/orders/'.$shipment->order_id,
            [
                ['label' => __('notifications.shipment_problem.order'), 'value' => '#'.$number],
                ['label' => __('notifications.shipment_problem.tracking'), 'value' => $shipment->tracking_number],
                ['label' => __('notifications.shipment_problem.state'), 'value' => $shipment->state->label()],
            ],
            __('notifications.shipment_problem.action'),
            dedupeKey: 'shipment:'.$shipment->id.':'.$shipment->state->value.':'.($shipment->carrier_code ?? 0),
        ));
    }

    /** An order the store set to ship by itself on confirming couldn't be shipped. */
    public function shipmentFailed(Order $order, string $carrier, string $reason): void
    {
        $this->center->toStore($order->tenant_id, new Notice(
            NotificationEvent::ShipmentProblem,
            __('notifications.shipment_failed.title', ['number' => $order->order_number, 'carrier' => $carrier]),
            $reason,
            '/dashboard/orders/'.$order->id,
            [['label' => __('notifications.shipment_problem.order'), 'value' => '#'.$order->order_number]],
            __('notifications.shipment_problem.action'),
            dedupeKey: 'shipment_failed:'.$order->id.':'.now()->format('YmdH'),
        ));
    }

    /** A customer sent the receipt of a prepaid order: the merchant checks the money arrived and confirms it. */
    public function receiptSubmitted(Order $order, OrderPayment $payment): void
    {
        $total = Money::toCents((string) $payment->amount);
        $this->center->toStore($order->tenant_id, new Notice(
            NotificationEvent::PaymentReceipt,
            __('notifications.payment_receipt.title', ['number' => $order->order_number]),
            __('notifications.payment_receipt.body', ['customer' => (string) ($order->customer_name ?: $order->customer_phone), 'total' => $this->money($total), 'method' => $payment->method_name]),
            '/dashboard/orders/'.$order->id,
            [
                ['label' => __('notifications.new_order.number'), 'value' => '#'.$order->order_number],
                ['label' => __('notifications.payment_receipt.method'), 'value' => $payment->method_name],
                ['label' => __('notifications.new_order.total'), 'value' => $this->money($total)],
            ],
            __('notifications.payment_receipt.action'),
            dedupeKey: 'payment_receipt:'.$payment->id,
        ));
    }

    /** The store's own mailbox refused: its emails go from the platform's address until it is fixed (once a day). */
    public function mailboxFailed(int $tenantId, string $reason): void
    {
        $this->center->toStore($tenantId, new Notice(
            NotificationEvent::MailboxFailed,
            __('notifications.mailbox_failed.title'),
            __('notifications.mailbox_failed.body', ['reason' => $reason]),
            '/dashboard/settings/emails',
            [],
            __('notifications.mailbox_failed.action'),
            dedupeKey: 'mailbox_failed:'.now()->format('Ymd'),
        ));
    }

    private function store(int $tenantId): string
    {
        return (string) Tenant::query()->whereKey($tenantId)->value('name');
    }

    private function money(int $cents): string
    {
        return __('notifications.money', ['amount' => $this->plain($cents)]);
    }

    private function plain(int $cents): string
    {
        return number_format($cents / 100, $cents % 100 === 0 ? 0 : 2);
    }

    private function date(CarbonInterface $at): string
    {
        return $at->copy()->setTimezone(CairoTime::ZONE)->format('Y-m-d');
    }
}
