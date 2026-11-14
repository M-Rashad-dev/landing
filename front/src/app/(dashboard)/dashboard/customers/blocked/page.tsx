import type { Metadata } from "next";
import { Suspense } from "react";
import { BlockedPage } from "@/features/customers/blocked-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.orders.blocked.title };

export default function Page() {
  return (
    <Suspense>
      <BlockedPage />
    </Suspense>
  );
}
