import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomersPage } from "@/features/customers/customers-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.orders.customers.title };

export default function Page() {
  return (
    <Suspense>
      <CustomersPage />
    </Suspense>
  );
}
