import type { Metadata } from "next";
import { ThemePage } from "@/features/builder/theme-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.design.page.title };

export default function Page() {
  return <ThemePage />;
}
