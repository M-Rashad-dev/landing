"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { errorMessage } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import type { AiTokens } from "@/themes/shared/ai-section/types";
import { AiSectionView } from "@/themes/shared/ai-section/view";
import { archiveSection, mySectionsKey, useMySections, type MyAiSection } from "./api";

const t = ar.aiDesigner;

export function MySectionsGalleryBlock({
  kind,
  themeKey,
  tokens,
  open,
  onPickSection,
  onOpenAiDesigner,
  showAiCard = false,
}: {
  kind: "store" | "landing";
  themeKey: string;
  tokens: AiTokens;
  open: boolean;
  onPickSection: (section: MyAiSection) => void;
  onOpenAiDesigner?: () => void;
  /** Hidden in Stage 1; turned on in Stage 2 when the designer feature is enabled. */
  showAiCard?: boolean;
}) {
  const client = useQueryClient();
  const query = useMySections(kind, themeKey, open);
  const [archiving, setArchiving] = React.useState<MyAiSection | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function handleArchive() {
    if (!archiving) return;
    setBusy(true);
    try {
      await archiveSection(archiving.id);
      await client.invalidateQueries({ queryKey: mySectionsKey(kind, themeKey) });
      toast.success(t.mySections.archived);
      setArchiving(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-4 border-t border-border pt-4">
      {showAiCard && onOpenAiDesigner ? (
        <button
          type="button"
          onClick={onOpenAiDesigner}
          className="group flex w-full items-center gap-3 rounded-xl border border-violet-300 bg-gradient-to-l from-violet-50 via-fuchsia-50 to-pink-50 p-4 text-start transition hover:-translate-y-0.5 hover:border-violet-500 hover:shadow-md"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 text-white shadow-sm">
            <Sparkles className="size-5" />
          </span>
          <span className="flex flex-col">
            <span className="font-bold text-ink">{t.galleryCardTitle}</span>
            <span className="text-xs text-ink-2">{t.galleryCardHint}</span>
          </span>
        </button>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex flex-col">
          <h4 className="text-sm font-bold text-ink">{t.mySections.title}</h4>
          <p className="text-xs text-ink-3">{t.mySections.hint}</p>
        </div>

        {query.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
        ) : query.isError ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : !Array.isArray(query.data) || query.data.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-ink-3">
            {t.mySections.empty}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {query.data.map((sec) => (
              <li
                key={sec.id}
                className="flex flex-col justify-between gap-2.5 rounded-xl border border-border bg-surface p-3"
              >
                <div className="relative h-28 w-full overflow-hidden rounded-lg border border-border bg-surface-2">
                  <div
                    className="pointer-events-none origin-top-right"
                    style={{ width: "333%", transform: "scale(0.3)" }}
                  >
                    <AiSectionView
                      definition={sec.current}
                      values={{}}
                      mode="builder"
                      tokens={tokens}
                      sampleMode
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{sec.name}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onPickSection(sec)}
                    >
                      <Plus className="size-3.5" />
                      {t.mySections.add}
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="hover:text-danger"
                      aria-label={t.mySections.archive}
                      onClick={() => setArchiving(sec)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={t.mySections.archiveConfirmTitle}
        description={t.mySections.archiveConfirmDesc}
        confirmLabel={t.mySections.archive}
        destructive
        loading={busy}
        onConfirm={() => void handleArchive()}
      />
    </div>
  );
}

