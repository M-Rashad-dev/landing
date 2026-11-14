"use client";

import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { errorMessage } from "@/lib/api/errors";
import { BidayaPage } from "@/themes/bidaya/page";
import { toLandingData, useLandingEditor } from "./builder-api";

/** The saved draft as the page will look, full screen (the order form sends nothing here). */
export function LandingPreview({ id }: { id: number }) {
  const { page, preview } = useLandingEditor(id);
  if (page.isPending || preview.isPending) return <Skeleton className="h-dvh rounded-none" />;
  if (page.isError || preview.isError) {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <ErrorState onRetry={() => void (page.isError ? page.refetch() : preview.refetch())} message={errorMessage(page.error ?? preview.error)} />
      </div>
    );
  }
  return (
    <div className="min-h-dvh">
      <BidayaPage content={page.data.draft_content} data={toLandingData(preview.data)} mode="preview" />
    </div>
  );
}
