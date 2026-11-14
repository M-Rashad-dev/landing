"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { RadioCards } from "@/components/ui/choice";
import { toast } from "@/components/ui/feedback";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { errorMessage } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import { deleteCategory, descendantIds, useRefreshCategories, type Category } from "./api";

const t = ar.catalog.categories.deleteDialog;

/**
 * Delete a category. With sub-categories the owner chooses: move them one level up,
 * or delete them with it at every level. Products are never deleted.
 */
export function DeleteCategoryDialog({ category, categories, onClose }: { category: Category | null; categories: Category[]; onClose: () => void }) {
  const [mode, setMode] = React.useState<"lift" | "delete">("lift");
  const [busy, setBusy] = React.useState(false);
  const refresh = useRefreshCategories();
  const under = category ? descendantIds(categories, category.id).length - 1 : 0;
  const direct = category ? categories.filter((c) => c.parent_id === category.id).length : 0;

  async function confirm() {
    if (!category) return;
    setBusy(true);
    try {
      await deleteCategory(category.id, under > 0 ? mode : "lift");
      toast.success(ar.catalog.categories.deleted);
      await refresh();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={category !== null}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setMode("lift");
        }
      }}
    >
      <DialogContent size={under > 0 ? "md" : "sm"}>
        <DialogHeader title={category ? t.title(category.name) : ""} description={t.text} />
        {under > 0 ? (
          <DialogBody className="flex flex-col gap-3">
            <p className="text-sm font-semibold">{t.childrenQuestion(direct)}</p>
            <RadioCards
              value={mode}
              onValueChange={(v) => setMode(v as "lift" | "delete")}
              className="sm:grid-cols-1"
              options={[
                { value: "lift", title: t.lift, description: t.liftHint },
                { value: "delete", title: t.deleteAll, description: t.deleteAllHint(under) },
              ]}
            />
          </DialogBody>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {ar.common.cancel}
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void confirm()}>
            {t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
