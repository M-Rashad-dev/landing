import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { InvoiceStatus, PaymentStatus } from "@/lib/billing/payments";
import { ar } from "@/messages/ar";

const t = ar.billing.invoices;

const INVOICE: Record<InvoiceStatus, BadgeVariant> = {
  open: "info",
  pending_review: "warning",
  paid: "success",
  cancelled: "secondary",
  expired: "secondary",
  refunded: "outline",
};

const PAYMENT: Record<PaymentStatus, BadgeVariant> = { pending_review: "warning", approved: "success", rejected: "destructive" };

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={INVOICE[status]}>{t.statuses[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={PAYMENT[status]}>{t.paymentStatuses[status]}</Badge>;
}
