import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { getSession } from "@/lib/auth/session";
import { ar } from "@/messages/ar";
import { HomeOverview } from "./home-overview";

export const metadata: Metadata = { title: ar.nav.home };

export default async function DashboardHome() {
  const session = await getSession();

  return (
    <>
      <PageHeader title={ar.dashboard.welcomeTitle(session.user.name)} description={ar.dashboard.welcomeText} />
      <HomeOverview />
    </>
  );
}
