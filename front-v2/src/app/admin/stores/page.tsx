import type { Metadata } from "next";
import { StoresPage } from "@/features/admin/stores-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.stores.title };

export default function AdminStoresPage() {
  return <StoresPage />;
}
