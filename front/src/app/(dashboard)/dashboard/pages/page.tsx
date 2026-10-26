import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ar } from "@/messages/ar";
import { PagesList } from "./pages-list";

export const metadata: Metadata = { title: ar.pages.title };

export default function PagesPage() {
  return (
    <>
      <PageHeader
        title={ar.pages.title}
        description={ar.pages.description}
        actions={
          <Button asChild>
            <Link href="/dashboard/pages/new">
              <Plus />
              {ar.pages.new}
            </Link>
          </Button>
        }
      />
      <PagesList />
    </>
  );
}
