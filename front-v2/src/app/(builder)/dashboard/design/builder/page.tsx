import type { Metadata } from "next";
import { Builder } from "@/features/builder/builder";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.design.page.title };

export default function Page() {
  return <Builder />;
}
