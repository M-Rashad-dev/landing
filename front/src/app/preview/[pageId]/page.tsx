import "@/components/shared/dashboard-fonts";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/700.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { isApiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import type { PreviewData } from "@/lib/pages/api";
import { ar } from "@/messages/ar";
import { PreviewCanvas } from "./preview-canvas";

export const metadata: Metadata = { title: ar.builder.preview, robots: { index: false, follow: false } };

/** Builder preview (app host only, needs the dashboard cookie). Renders the draft with tracking and orders disabled. */
export default async function PreviewPage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  if (!/^\d+$/.test(pageId)) notFound();

  const session = await getSession();
  let data: PreviewData;
  try {
    data = await serverApi<PreviewData>(`/dashboard/pages/${pageId}/preview`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  return <PreviewCanvas initial={data} host={session.primary_host ?? ""} />;
}
