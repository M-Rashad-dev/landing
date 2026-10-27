import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/orders/api";
import { ar } from "@/messages/ar";

const VARIANTS: Record<OrderStatus, BadgeVariant> = {
  new: "info",
  confirmed: "default",
  delivered: "success",
  returned: "warning",
  damaged: "warning",
  fake: "destructive",
  cancelled: "secondary",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={VARIANTS[status]}>{ar.orders.statuses[status]}</Badge>;
}
