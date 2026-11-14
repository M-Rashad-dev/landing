import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlatformPageEditor } from "@/features/admin/pages-page";
import { platformUrl } from "@/features/marketing/plans";
import { platformPageSlug } from "@/lib/host/platform-pages";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.pages.title };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const slug = platformPageSlug((await params).slug);
  if (!slug) notFound();
  return <PlatformPageEditor slug={slug} siteUrl={platformUrl()} />;
}
