"use client";

import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { errorMessage } from "@/lib/api/errors";
import { AsasStore } from "@/themes/asas/asas-store";
import { useDesign } from "./api";

/** The saved draft as the store will look, full page (links stay inert until the storefront exists). */
export function PreviewPage() {
  const query = useDesign();
  if (query.isPending) return <Skeleton className="h-dvh rounded-none" />;
  if (query.isError) {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      </div>
    );
  }
  return (
    <div className="min-h-dvh">
      <AsasStore design={query.data.draft} data={query.data.data} storeName={query.data.store_name} mode="preview" />
    </div>
  );
}
