import { Badge, type Tone } from "@/components/ui/badge";
import { ar } from "@/messages/ar";

/** Order statuses (back: App\Enums\OrderStatus) with one fixed color each, everywhere. */
export const ORDER_STATUSES = ["new", "confirmed", "delivered", "returned", "damaged", "fake", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TONES: Record<OrderStatus, Tone> = {
  new: "attention",
  confirmed: "info",
  delivered: "success",
  returned: "warning",
  damaged: "danger",
  fake: "danger",
  cancelled: "neutral",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={TONES[status]} dot>
      {ar.domain.orderStatus[status]}
    </Badge>
  );
}

export type InvoiceStatus = "open" | "pending_review" | "paid" | "cancelled" | "expired" | "refunded";
const INVOICE_TONES: Record<InvoiceStatus, Tone> = { open: "info", pending_review: "attention", paid: "success", cancelled: "neutral", expired: "neutral", refunded: "warning" };

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={INVOICE_TONES[status]}>{ar.domain.invoiceStatus[status]}</Badge>;
}
