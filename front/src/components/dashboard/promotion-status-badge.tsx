import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { PromotionStatus } from "@/lib/types";
import { ar } from "@/messages/ar";

const VARIANTS: Record<PromotionStatus, BadgeVariant> = {
  inactive: "secondary",
  scheduled: "info",
  active: "success",
  expired: "warning",
};

export function PromotionStatusBadge({ status }: { status: PromotionStatus }) {
  return <Badge variant={VARIANTS[status]}>{ar.promotions.status[status]}</Badge>;
}

export const PROMOTION_STATUS_OPTIONS = [
  { value: "", label: ar.promotions.allStatuses },
  { value: "active", label: ar.promotions.status.active },
  { value: "scheduled", label: ar.promotions.status.scheduled },
  { value: "expired", label: ar.promotions.status.expired },
  { value: "inactive", label: ar.promotions.status.inactive },
];
