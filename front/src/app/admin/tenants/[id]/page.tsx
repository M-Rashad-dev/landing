import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ar } from "@/messages/ar";
import { TenantDetails } from "./tenant-details";

export const metadata: Metadata = { title: ar.admin.nav.tenants };

export default async function TenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = Number(id);
  if (!Number.isInteger(tenantId) || tenantId <= 0) notFound();

  return <TenantDetails id={tenantId} />;
}
