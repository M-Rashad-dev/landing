import type { Metadata } from "next";
import { StorePage } from "@/features/store/store-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.settings.store.title };

export default function Page() {
  return (
    <StorePage />
  );
}
