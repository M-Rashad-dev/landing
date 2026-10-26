import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { getSession } from "@/lib/auth/session";
import { ar } from "@/messages/ar";
import { IdentityForm } from "../identity-form";

export const metadata: Metadata = { title: ar.identities.new };

export default async function NewIdentityPage() {
  const session = await getSession();
  return (
    <>
      <PageHeader title={ar.identities.new} />
      <IdentityForm storeName={session.tenant?.name ?? ""} />
    </>
  );
}
