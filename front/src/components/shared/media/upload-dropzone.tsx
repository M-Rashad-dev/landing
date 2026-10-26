"use client";

import { AlertCircle, CheckCircle2, UploadCloud } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { UploadItem } from "@/lib/media/hooks";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const LOCAL_ERRORS: Record<string, string> = ar.media.localErrors;

export function UploadDropzone({
  onFiles,
  items,
  disabled,
  multiple = true,
  compact = false,
}: {
  onFiles: (files: File[]) => void;
  items: UploadItem[];
  disabled?: boolean;
  multiple?: boolean;
  compact?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    onFiles(Array.from(list));
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-card px-4 text-center transition-colors focus-within:outline-2 focus-within:outline-ring",
          compact ? "py-6" : "py-10",
          dragging ? "border-primary bg-secondary" : "border-input hover:border-primary/60",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <UploadCloud className="size-8 text-primary" aria-hidden />
        <span className="font-semibold">{dragging ? ar.media.dropActive : ar.media.dropHere}</span>
        <span className="text-xs text-muted-foreground">{ar.media.dropHint}</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={multiple}
          className="sr-only"
          disabled={disabled}
          onChange={(event) => handleFiles(event.target.files)}
        />
      </label>

      {items.length ? (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
              {item.status === "done" ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
              ) : item.status === "error" ? (
                <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden />
              ) : (
                <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-primary border-e-transparent" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium" dir="auto">
                  {item.file.name}
                </p>
                {item.status === "error" ? (
                  <p className="text-xs text-destructive">{LOCAL_ERRORS[item.error ?? ""] ?? item.error ?? ar.media.failed}</p>
                ) : item.status !== "done" ? (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-primary transition-[width]" style={{ width: `${item.progress}%` }} />
                  </div>
                ) : null}
              </div>
              {item.status === "uploading" ? <span className="text-xs tabular-nums text-muted-foreground">{item.progress}%</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
