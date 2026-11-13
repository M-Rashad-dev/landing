import type { Metadata } from "next";
import { StorePagesPage } from "@/features/store-pages/pages-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.storePages.title };

export default function Page() {
  return <StorePagesPage />;
}
