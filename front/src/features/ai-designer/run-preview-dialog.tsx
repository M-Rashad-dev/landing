"use client";

import { Check, Laptop, Smartphone, X } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { DeviceFrame } from "@/features/builder/kit";
import { toLandingData, type PreviewData } from "@/features/landings/builder-api";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import type { Content } from "@/themes/landing/bidaya/types";
import { landingTheme } from "@/themes/landing/registry";
import type { Design } from "@/themes/store/asas/types";
import { storeTheme } from "@/themes/store/registry";
import type { DesignData } from "@/themes/store/shared/types";
import { useDesignRun, type AiRunPayload } from "./api";

const t = ar.aiDesigner;

export function RunPreviewDialog({
  runId,
  open,
  onOpenChange,
  kind,
  themeKey,
  busy = false,
  onApply,
  onReject,
}: {
  runId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "store" | "landing";
  themeKey: string;
  busy?: boolean;
  onApply: (run: AiRunPayload) => void;
  onReject: (run: AiRunPayload) => void;
}) {
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const runQuery = useDesignRun(runId, open && runId !== null);
  const run = runQuery.data ?? null;

  const isProposed = run?.status === "proposed";

  const { Canvas: StoreCanvas } = React.useMemo(() => storeTheme(themeKey), [themeKey]);
  const { Page: LandingPage } = React.useMemo(() => landingTheme(themeKey), [themeKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-w-6xl">
        <DialogHeader
          title={t.run.previewButton}
          description={run ? t.run.statuses[run.status] : undefined}
        />
        <DialogBody className="flex flex-col gap-4">
          {runQuery.isLoading ? (
            <Skeleton className="h-[65vh] w-full rounded-xl" />
          ) : runQuery.isError || !run || !run.proposal ? (
            <ErrorState
              message={runQuery.error ? errorMessage(runQuery.error) : t.chat.unavailable}
              onRetry={() => void runQuery.refetch()}
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <Badge
                  tone={
                    run.status === "applied"
                      ? "success"
                      : run.status === "rejected" || run.status === "failed"
                        ? "danger"
                        : "brand"
                  }
                >
                  {t.run.statuses[run.status]}
                </Badge>

                <div
                  className="flex rounded-lg bg-surface-2 p-0.5"
                  role="radiogroup"
                  aria-label={ar.design.builder.device}
                >
                  {(["desktop", "mobile"] as const).map((dv) => {
                    const Icon = dv === "desktop" ? Laptop : Smartphone;
                    const label = dv === "desktop" ? t.preview.desktop : t.preview.mobile;
                    return (
                      <button
                        key={dv}
                        type="button"
                        role="radio"
                        aria-checked={device === dv}
                        onClick={() => setDevice(dv)}
                        className={cn(
                          "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition",
                          device === dv
                            ? "bg-surface text-ink shadow-sm"
                            : "text-ink-3 hover:text-ink",
                        )}
                      >
                        <Icon className="size-3.5" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-[65vh] overflow-hidden rounded-xl border border-border bg-surface-2 p-3">
                <DeviceFrame device={device}>
                  <div className="h-full overflow-y-auto">
                    {kind === "store" ? (
                      <StoreCanvas
                        design={run.proposal as unknown as Design}
                        data={
                          ((run.preview_data?.data as DesignData | undefined) ?? {
                            products: {},
                            view_all: {},
                            links: {},
                            media: {},
                            categories: [],
                            pages: [],
                            reviews: [],
                          }) as DesignData
                        }
                        storeName={String(run.preview_data?.store_name ?? "")}
                        mode="preview"
                        selected={null}
                        onSelect={() => {}}
                        media={{}}
                        tools={() => null}
                      />
                    ) : (
                      <LandingPage
                        content={run.proposal as unknown as Content}
                        data={toLandingData(
                          (run.preview_data as unknown as PreviewData) ?? {
                            page: { id: 0, slug: "", title: "" },
                            product: null,
                            offers: [],
                            media: {},
                            shipping: { enabled: false, default_fee: 0, free_over: null, companies: [] },
                            reviews: { count: 0, average: 0, items: [] },
                            store_name: "",
                          },
                        )}
                        mode="preview"
                        selected={null}
                        onSelect={() => {}}
                        media={{}}
                        tools={() => null}
                      />
                    )}
                  </div>
                </DeviceFrame>
              </div>
            </>
          )}
        </DialogBody>

        <DialogFooter>
          {isProposed && run ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => onReject(run)}
              >
                <X className="size-4" />
                {t.run.rejectButton}
              </Button>
              <Button
                type="button"
                loading={busy}
                onClick={() => onApply(run)}
              >
                <Check className="size-4" />
                {t.run.applyButton}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.preview.close}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
