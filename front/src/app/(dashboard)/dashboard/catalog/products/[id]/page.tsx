import type { Metadata } from "next";
import { EditProduct } from "@/features/catalog/products/edit-product";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.catalog.form.editTitle };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditProduct id={Number(id)} />;
}
