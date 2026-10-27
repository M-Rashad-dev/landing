import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { ar } from "@/messages/ar";

/** 404 inside the dashboard shell (deleted page, product, order...). */
export default function DashboardNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title={ar.errors.notFoundTitle}
      description={ar.errors.notFoundText}
      className="mt-6"
      action={
        <Button asChild variant="outline">
          <Link href="/dashboard">{ar.errors.backHome}</Link>
        </Button>
      }
    />
  );
}
