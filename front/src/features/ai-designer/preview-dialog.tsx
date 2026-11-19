"use client";

import { Check, Laptop, Smartphone, X } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioCards } from "@/components/ui/choice";
import { Alert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { DeviceFrame } from "@/features/builder/kit";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import type { AiSectionRuntimeData, AiTokens } from "@/themes/shared/ai-section/types";
import { AiSectionView } from "@/themes/shared/ai-section/view";
import type { AiVersionPayload } from "./api";

const t = ar.aiDesigner;

function suggestCopyName(baseName: string, suffix: string): string {
  const clean = baseName.trim();
  if (clean.includes(suffix)) return clean.slice(0, 100);
  const candidate = `${clean} ${suffix}`.trim();
  return candidate.length <= 100
    ? candidate
    : `${clean.slice(0, Math.max(1, 99 - suffix.length)).trim()} ${suffix}`;
}

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
  onApprove: (version: AiVersionPayload, options: { name: string; mode: "replace" | "new" }) => void;
  onReject: (version: AiVersionPayload) => void;
}) {
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [customName, setCustomName] = React.useState("");
  const [nameTouched, setNameTouched] = React.useState(false);
  const [confirmEditOpen, setConfirmEditOpen] = React.useState(false);
  const [saveMode, setSaveMode] = React.useState<"replace" | "new">("replace");

  const nameInputId = React.useId();
  const modalNameId = React.useId();

  const syncKey = open && version ? `${version.id}:${version.status}` : null;
  const [prevSyncKey, setPrevSyncKey] = React.useState<string | null>(null);
  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    if (open && version) {
      setCustomName(version.name);
      setNameTouched(false);
      setSaveMode("replace");
      setConfirmEditOpen(false);
    }
  }

  if (!version) return null;

  const isProposed = version.status === "proposed";
  const isEdit = version.ai_section_id !== null;
  const targetName = version.target_section_name?.trim() || version.name;
  const trimmedName = customName.trim();
  const effectiveName = trimmedName || version.name;
  const isSameAsOriginal = trimmedName !== "" && trimmedName === targetName.trim();

  function handleModeChange(nextMode: "replace" | "new") {
    setSaveMode(nextMode);
    if (!nameTouched && version) {
      setCustomName(
        nextMode === "new"
          ? suggestCopyName(targetName, t.preview.newCopySuffix)
          : version.name,
      );
    }
  }

  function handleApproveClick() {
    if (!version || !trimmedName) return;
    if (isEdit) {
      setConfirmEditOpen(true);
      return;
    }
    onApprove(version, { name: trimmedName, mode: "new" });
  }

  function handleConfirmEdit() {
    if (!version || !trimmedName) return;
    onApprove(version, { name: trimmedName, mode: saveMode });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
        <DialogContent
          size="xl"
          className="fixed inset-0 start-0 top-0 flex h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col rounded-none"
        >
          <DialogHeader
            title={effectiveName}
            description={t.version.statuses[version.status]}
          />
          <DialogBody className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
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
                {isEdit ? (
                  <Badge tone="brand">{t.preview.editingBadge(targetName)}</Badge>
                ) : null}
              </div>

              {isProposed ? (
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:max-w-md">
                  <label htmlFor={nameInputId} className="shrink-0 text-xs font-bold text-ink-2">
                    {t.preview.nameLabel}
                  </label>
                  <div className="min-w-[12rem] flex-1">
                    <Input
                      id={nameInputId}
                      value={customName}
                      maxLength={100}
                      placeholder={t.preview.namePlaceholder}
                      aria-invalid={!trimmedName || undefined}
                      onChange={(e) => {
                        setCustomName(e.target.value);
                        setNameTouched(true);
                      }}
                    />
                  </div>
                  {!trimmedName ? (
                    <span className="text-[11px] font-semibold text-danger">
                      {t.preview.nameRequired}
                    </span>
                  ) : null}
                </div>
              ) : null}

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

            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface-2 p-3">
              <DeviceFrame device={device} host="">
                <div className="h-full overflow-y-auto bg-(--ai-bg)">
                  <AiSectionView
                    definition={{
                      id: version.id,
                      name: effectiveName,
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
                  loading={busy && !confirmEditOpen}
                  disabled={busy || !trimmedName}
                  onClick={handleApproveClick}
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

      {isEdit && isProposed ? (
        <Dialog open={confirmEditOpen} onOpenChange={(o) => !busy && setConfirmEditOpen(o)}>
          <DialogContent size="md">
            <DialogHeader
              title={t.preview.editModalTitle}
              description={t.preview.editingBadge(targetName)}
            />
            <DialogBody className="flex flex-col gap-4">
              <Alert
                tone={saveMode === "replace" ? "warning" : "info"}
                title={t.preview.editWarningTitle}
              >
                {t.preview.editWarningDesc(targetName)}
              </Alert>

              <RadioCards
                value={saveMode}
                onValueChange={(v) => handleModeChange(v === "new" ? "new" : "replace")}
                className="sm:grid-cols-1"
                options={[
                  {
                    value: "replace",
                    title: t.preview.modeReplaceTitle,
                    description: t.preview.modeReplaceDesc,
                  },
                  {
                    value: "new",
                    title: t.preview.modeNewTitle,
                    description: t.preview.modeNewDesc,
                  },
                ]}
              />

              <div className="flex flex-col gap-1.5">
                <label htmlFor={modalNameId} className="text-xs font-bold text-ink">
                  {t.preview.nameLabel}
                </label>
                <Input
                  id={modalNameId}
                  value={customName}
                  maxLength={100}
                  placeholder={t.preview.namePlaceholder}
                  aria-invalid={!trimmedName || undefined}
                  onChange={(e) => {
                    setCustomName(e.target.value);
                    setNameTouched(true);
                  }}
                />
                {!trimmedName ? (
                  <p className="text-xs font-semibold text-danger">{t.preview.nameRequired}</p>
                ) : saveMode === "new" && isSameAsOriginal ? (
                  <p className="text-xs text-warning">{t.preview.sameNameHint}</p>
                ) : (
                  <p className="text-xs text-ink-3">{t.preview.nameHint}</p>
                )}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmEditOpen(false)}
              >
                {t.preview.cancel}
              </Button>
              <Button
                type="button"
                variant={saveMode === "replace" ? "danger" : "primary"}
                loading={busy}
                disabled={!trimmedName}
                onClick={handleConfirmEdit}
              >
                <Check className="size-4" />
                {saveMode === "replace" ? t.preview.confirmReplace : t.preview.confirmNew}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

