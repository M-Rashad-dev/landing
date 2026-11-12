import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersPage } from "@/features/orders/orders-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.orders.title };

export default function Page() {
  return (
    <Suspense>
      <OrdersPage />
    </Suspense>
  );
}
