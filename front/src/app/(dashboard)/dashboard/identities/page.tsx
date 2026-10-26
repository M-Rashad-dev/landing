import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ar } from "@/messages/ar";
import { IdentitiesList } from "./identities-list";

export const metadata: Metadata = { title: ar.identities.title };

export default function IdentitiesPage() {
  return (
    <>
      <PageHeader
        title={ar.identities.title}
        description={ar.identities.description}
        actions={
          <Button asChild>
            <Link href="/dashboard/identities/new">
              <Plus />
              {ar.identities.new}
            </Link>
          </Button>
        }
      />
      <IdentitiesList />
    </>
  );
}
