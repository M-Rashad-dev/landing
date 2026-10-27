import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { AdminOverviewCards } from "./overview-cards";

export const metadata: Metadata = { title: ar.admin.nav.overview };

export default function AdminHome() {
  return (
    <>
      <PageHeader title={ar.admin.title} />
      <AdminOverviewCards />
    </>
  );
}
