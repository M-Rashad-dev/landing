import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { PaymentsManager } from "./payments-manager";

export const metadata: Metadata = { title: ar.admin.nav.payments };

export default function AdminPaymentsPage() {
  return (
    <>
      <PageHeader title={ar.admin.nav.payments} description={ar.admin.payments.description} />
      <PaymentsManager />
    </>
  );
}
