import type { Metadata } from "next";
import { RefundsPage } from "@/features/orders/refunds-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.refunds.page.title };

export default function Page() {
  return <RefundsPage />;
}
