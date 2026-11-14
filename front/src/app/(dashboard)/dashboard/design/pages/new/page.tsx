import type { Metadata } from "next";
import { StorePageEditor } from "@/features/store-pages/page-form";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.storePages.form.newTitle };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const key = (await searchParams).template;
  return <StorePageEditor id={null} templateKey={typeof key === "string" ? key : null} />;
}
