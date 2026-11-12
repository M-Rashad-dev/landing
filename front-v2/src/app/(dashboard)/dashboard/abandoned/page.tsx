import type { Metadata } from "next";
import { Suspense } from "react";
import { AbandonedPage } from "@/features/orders/abandoned-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.orders.abandoned.title };

export default function Page() {
  return (
    <Suspense>
      <AbandonedPage />
    </Suspense>
  );
}
