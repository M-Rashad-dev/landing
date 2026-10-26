import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuilderApp } from "@/components/builder/builder-app";
import { isApiError } from "@/lib/api/errors";
import { serverApi } from "@/lib/api/server";
import type { PageDetail } from "@/lib/pages/api";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.pages.openBuilder };

export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  let page: PageDetail;
  let themes: Array<{ key: string; name: string }>;
  try {
    [page, themes] = await Promise.all([serverApi<PageDetail>(`/dashboard/pages/${id}`), serverApi<Array<{ key: string; name: string }>>("/dashboard/themes")]);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  // Keep the page's current theme selectable even if it was disabled meanwhile.
  if (!themes.some((theme) => theme.key === page.theme_key)) themes = [...themes, { key: page.theme_key, name: page.theme_key }];

  return <BuilderApp page={page} themes={themes} />;
}
