import { Megaphone } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { ar } from "@/messages/ar";

/** Order statuses (back: App\Enums\OrderStatus) with one fixed color each, everywhere. */
export const ORDER_STATUSES = ["new", "confirmed", "shipped", "delivered", "returned", "damaged", "fake", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TONES: Record<OrderStatus, Tone> = {
  new: "attention",
  confirmed: "info",
  shipped: "brand-soft",
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

/**
 * Where an order came from: a landing page order carries a visible tag with the page name, so it
 * never gets lost among the store's own orders (owner request).
 */
export function OrderSourceTag({ source, page }: { source: "store" | "landing"; page: { title: string } | null }) {
  if (source === "store") return <span className="text-xs text-ink-3">{ar.domain.source.store}</span>;
  return (
    <Badge tone="info" size="sm" className="max-w-full">
      <Megaphone />
      <span className="truncate">{page ? `${ar.domain.source.landing}: ${page.title}` : ar.domain.source.landing}</span>
    </Badge>
  );
}

export type InvoiceStatus = "open" | "pending_review" | "paid" | "cancelled" | "expired" | "refunded";
const INVOICE_TONES: Record<InvoiceStatus, Tone> = { open: "info", pending_review: "attention", paid: "success", cancelled: "neutral", expired: "neutral", refunded: "warning" };

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={INVOICE_TONES[status]}>{ar.domain.invoiceStatus[status]}</Badge>;
}
