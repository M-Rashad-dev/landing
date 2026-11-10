import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { StoreBrowser } from "./store-browser";

export const metadata: Metadata = { title: ar.themeStore.storeTitle };

export default function ThemeStorePage() {
  return (
    <>
      <PageHeader title={ar.themeStore.storeTitle} description={ar.themeStore.storeDescription} />
      <StoreBrowser />
    </>
  );
}
