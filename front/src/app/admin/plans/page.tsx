import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ar } from "@/messages/ar";
import { PlansManager } from "./plans-manager";

export const metadata: Metadata = { title: ar.admin.nav.plans };

export default function AdminPlansPage() {
  return (
    <>
      <PageHeader
        title={ar.admin.nav.plans}
        description={ar.admin.plans.description}
        actions={
          <Button asChild>
            <Link href="/admin/plans/new">
              <Plus />
              {ar.admin.plans.newPlan}
            </Link>
          </Button>
        }
      />
      <PlansManager />
    </>
  );
}
