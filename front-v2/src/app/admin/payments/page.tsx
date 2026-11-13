import type { Metadata } from "next";
import { PaymentsPage } from "@/features/admin/payments-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.payments.title };

export default function Page() {
  return <PaymentsPage />;
}
