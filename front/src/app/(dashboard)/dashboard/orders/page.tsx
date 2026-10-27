import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { OrdersManager } from "./orders-manager";

export const metadata: Metadata = { title: ar.orders.title };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; page_id?: string }> }) {
  const { status, page_id } = await searchParams;
  return (
    <>
      <PageHeader title={ar.orders.title} description={ar.orders.description} />
      <OrdersManager initialStatus={status ?? ""} initialPageId={page_id && /^\d+$/.test(page_id) ? page_id : ""} />
    </>
  );
}
