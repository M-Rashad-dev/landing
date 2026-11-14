import type { Metadata } from "next";
import { PreviewPage } from "@/features/builder/preview-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.design.builder.preview };

export default function Page() {
  return <PreviewPage />;
}
