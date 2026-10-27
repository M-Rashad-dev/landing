import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { TenantsManager } from "./tenants-manager";

export const metadata: Metadata = { title: ar.admin.nav.tenants };

export default async function TenantsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const status = typeof params.status === "string" && ["active", "suspended"].includes(params.status) ? params.status : "";

  return (
    <>
      <PageHeader title={ar.admin.nav.tenants} description={ar.admin.tenants.description} />
      <TenantsManager initialStatus={status} />
    </>
  );
}
