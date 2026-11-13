import type { Metadata } from "next";
import { RefundsPage } from "@/features/admin/refunds-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.refunds.title };

export default function Page() {
  return <RefundsPage />;
}
