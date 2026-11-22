import type { Metadata } from "next";
import { PaymentsPage } from "@/features/settings/payments-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.settings.payments.title };

export default function Page() {
  return <PaymentsPage />;
}
