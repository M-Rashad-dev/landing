import { LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.nav.home };

export default async function DashboardHome() {
  const session = await getSession();

  return (
    <>
      <PageHeader title={ar.dashboard.welcomeTitle(session.user.name)} description={ar.dashboard.welcomeText} />
      <EmptyState
        icon={LayoutDashboard}
        title={ar.dashboard.emptyTitle}
        description={ar.dashboard.emptyText}
        action={
          <Button asChild>
            <Link href="/dashboard/settings">{ar.nav.settings}</Link>
          </Button>
        }
      />
    </>
  );
}
