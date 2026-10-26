import { PenSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { isApiError } from "@/lib/api/errors";
import { serverApi } from "@/lib/api/server";
import type { PageDetail } from "@/lib/pages/api";
import { ar } from "@/messages/ar";
import { PageSettingsForm } from "./page-settings-form";

export const metadata: Metadata = { title: ar.pages.settingsPage.title };

export default async function PageSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  let page: PageDetail;
  try {
    page = await serverApi<PageDetail>(`/dashboard/pages/${id}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <PageHeader
        title={ar.pages.settingsPage.title}
        description={page.title}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/dashboard/pages/${page.id}/builder`}>
              <PenSquare />
              {ar.pages.openBuilder}
            </Link>
          </Button>
        }
      />
      <PageSettingsForm key={page.updated_at ?? page.id} page={page} />
    </>
  );
}
