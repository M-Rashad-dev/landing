import type { Metadata } from "next";
import { PlatformPagesPage } from "@/features/admin/pages-page";
import { platformUrl } from "@/features/marketing/plans";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.pages.title };

export default function Page() {
  return <PlatformPagesPage siteUrl={platformUrl()} />;
}
