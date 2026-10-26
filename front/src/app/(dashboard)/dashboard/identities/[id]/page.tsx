import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { serverApi } from "@/lib/api/server";
import { isApiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import type { Identity } from "@/lib/types";
import { ar } from "@/messages/ar";
import { IdentityForm } from "../identity-form";

export const metadata: Metadata = { title: ar.identities.edit };

export default async function EditIdentityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const session = await getSession();
  let identity: Identity;
  try {
    identity = await serverApi<Identity>(`/dashboard/identities/${id}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <PageHeader title={ar.identities.edit} description={identity.name} />
      <IdentityForm key={identity.updated_at ?? identity.id} identity={identity} storeName={session.tenant?.name ?? ""} />
    </>
  );
}
