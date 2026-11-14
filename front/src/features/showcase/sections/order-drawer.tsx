"use client";

import { CheckCircle2, Phone } from "lucide-react";
import { DescriptionList, EntityCell, Price } from "@/components/data/details";
import { OrderStatusBadge } from "@/components/domain/order-status";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { formatDateTime } from "@/lib/format";
import { ar } from "@/messages/ar";
import { DEMO_THUMB, type DemoOrder } from "../fixtures";

const d = ar.showcase.details;

/** Quick view of an order from the list: details + main actions, without leaving the table. */
export function OrderDrawer({ order, onClose }: { order: DemoOrder | null; onClose: () => void }) {
  return (
    <Drawer
      open={order !== null}
      onOpenChange={(open) => !open && onClose()}
      title={order ? `#${order.number}` : ""}
      description={order ? `${formatDateTime(order.createdAt)} · ${ar.domain.source[order.source]}` : undefined}
      footer={
        <>
          <Button className="flex-1">
            <CheckCircle2 />
            {ar.showcase.table.confirm}
          </Button>
          <Button variant="outline">
            <Phone />
            {d.fields.phone}
          </Button>
        </>
      }
    >
      {order ? (
        <div className="flex flex-col gap-5">
          <span className="self-start">
            <OrderStatusBadge status={order.status} />
          </span>
          <EntityCell avatar={order.customer} title={order.customer} subtitle={<span dir="ltr">{order.phone}</span>} />
          <EntityCell image={DEMO_THUMB} title={order.product} subtitle={<Price value={order.total} size="sm" />} />
          <DescriptionList
            columns={1}
            items={[
              { label: d.fields.governorate, value: order.governorate },
              { label: d.fields.payment, value: d.cod },
              { label: d.fields.source, value: ar.domain.source[order.source] },
            ]}
          />
        </div>
      ) : null}
    </Drawer>
  );
}
