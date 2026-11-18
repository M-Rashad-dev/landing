"use client";

import { Check, Laptop, Smartphone, X } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { DeviceFrame } from "@/features/builder/kit";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import type { AiSectionRuntimeData, AiTokens } from "@/themes/shared/ai-section/types";
import { AiSectionView } from "@/themes/shared/ai-section/view";
import type { AiVersionPayload } from "./api";

const t = ar.aiDesigner;

export function PreviewDialog({
  version,
  open,
  onOpenChange,
  tokens,
  values = {},
  data,
  busy = false,
  onApprove,
  onReject,
}: {
  version: AiVersionPayload | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind?: "store" | "landing";
  tokens: AiTokens;
  values?: Record<string, unknown>;
  data?: AiSectionRuntimeData;
  busy?: boolean;
  onApprove: (version: AiVersionPayload) => void;
  onReject: (version: AiVersionPayload) => void;
}) {
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");

  if (!version) return null;

  const isProposed = version.status === "proposed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-w-5xl">
        <DialogHeader
          title={version.name}
          description={t.version.statuses[version.status]}
        />
        <DialogBody className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <Badge
              tone={
                version.status === "approved"
                  ? "success"
                  : version.status === "rejected"
                    ? "danger"
                    : "brand"
              }
            >
              {t.version.statuses[version.status]}
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

          <div className="h-[60vh] overflow-hidden rounded-xl border border-border bg-surface-2 p-3">
            <DeviceFrame device={device}>
              <div className="h-full overflow-y-auto bg-(--ai-bg)">
                <AiSectionView
                  definition={{
                    id: version.id,
                    name: version.name,
                    html: version.html,
                    css: version.css,
                    fields: version.fields,
                  }}
                  values={values}
                  mode="preview"
                  tokens={tokens}
                  data={data}
                  sampleMode
                />
              </div>
            </DeviceFrame>
          </div>
        </DialogBody>

        <DialogFooter>
          {isProposed ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => onReject(version)}
              >
                <X className="size-4" />
                {t.preview.reject}
              </Button>
              <Button
                type="button"
                loading={busy}
                onClick={() => onApprove(version)}
              >
                <Check className="size-4" />
                {t.preview.approve}
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
