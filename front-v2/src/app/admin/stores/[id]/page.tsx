import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorePage } from "@/features/admin/store-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.stores.title };

export default async function AdminStorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storeId = Number(id);
  if (!Number.isInteger(storeId) || storeId < 1) notFound();
  return <StorePage id={storeId} />;
}
