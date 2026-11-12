import type { Metadata } from "next";
import { CustomerPage } from "@/features/customers/customer-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.orders.customers.title };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerPage id={Number(id)} />;
}
