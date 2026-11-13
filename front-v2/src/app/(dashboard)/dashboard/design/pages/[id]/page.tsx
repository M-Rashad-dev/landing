import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorePageEditor } from "@/features/store-pages/page-form";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.storePages.form.editTitle };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) notFound();
  return <StorePageEditor id={Number(id)} templateKey={null} />;
}
