"use client";

import { FileUp, ImagePlus, Loader2, Paperclip, X } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import type { ProductInput } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.storefront.inputs;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif";
const FILE_ACCEPT = `${IMAGE_ACCEPT},application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.ai,.psd,.cdr,.eps`;

const isUpload = (input: ProductInput) => input.kind === "image" || input.kind === "file";
const maxLength = (input: ProductInput) => (input.kind === "textarea" ? 1000 : 200);

/** Sends one file to the store (POST /api/public/uploads); answers the token the order sends back. */
export async function uploadCustomerFile(inputId: number, file: File): Promise<{ token: string; name: string }> {
  const form = new FormData();
  form.set("input_id", String(inputId));
  form.set("file", file, file.name);
  const response = await fetch("/api/public/uploads", { method: "POST", body: form, credentials: "same-origin", headers: { Accept: "application/json" } });
  const json = (await response.json().catch(() => ({}))) as { data?: { token: string; name: string }; errors?: Record<string, string[]>; message?: string };
  if (response.ok && json.data) return json.data;
  throw new Error(json.errors?.file?.[0] ?? json.errors?.input_id?.[0] ?? (response.status === 429 ? t.tooMany : t.uploadFailed));
}

/**
 * «حسب الطلب» fields of a product, whatever the theme: the texts typed, the files uploaded (each sent at once and
 * kept as its token), what's missing, the extra price, and what the order sends. `live` false (builder, previews)
 * uploads nothing.
 */
export function useCustomerInputs(inputs: ProductInput[] | undefined, live = true) {
  const list = React.useMemo(() => inputs ?? [], [inputs]);
  const [values, setValues] = React.useState<Record<number, string>>({});
  const [files, setFiles] = React.useState<Record<number, string>>({});
  const [busy, setBusy] = React.useState<Record<number, boolean>>({});
  const [errors, setErrors] = React.useState<Record<number, string>>({});
  const [showMissing, setShowMissing] = React.useState(false);

  const clearError = (id: number) =>
    setErrors((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });

  const setText = (id: number, value: string) => {
    setValues((v) => ({ ...v, [id]: value }));
    clearError(id);
  };

  const upload = async (input: ProductInput, file: File) => {
    clearError(input.id);
    if (file.size > MAX_UPLOAD_BYTES) {
      setErrors((e) => ({ ...e, [input.id]: t.tooBig(10) }));
      return;
    }
    if (input.kind === "image" && !file.type.startsWith("image/")) {
      setErrors((e) => ({ ...e, [input.id]: t.imageOnly }));
      return;
    }
    if (!live) {
      setFiles((f) => ({ ...f, [input.id]: file.name }));
      return;
    }
    setBusy((b) => ({ ...b, [input.id]: true }));
    try {
      const saved = await uploadCustomerFile(input.id, file);
      setValues((v) => ({ ...v, [input.id]: saved.token }));
      setFiles((f) => ({ ...f, [input.id]: saved.name }));
    } catch (error) {
      setErrors((e) => ({ ...e, [input.id]: error instanceof Error ? error.message : t.uploadFailed }));
    } finally {
      setBusy((b) => ({ ...b, [input.id]: false }));
    }
  };

  const removeFile = (id: number) => {
    setValues((v) => {
      const next = { ...v };
      delete next[id];
      return next;
    });
    setFiles((f) => {
      const next = { ...f };
      delete next[id];
      return next;
    });
  };

  const filled = (input: ProductInput) => (values[input.id] ?? "").trim() !== "";
  const missing = list.filter((i) => i.is_required && !filled(i));
  const uploading = Object.values(busy).some(Boolean);

  return {
    list,
    values,
    files,
    busy,
    /** Field errors: the visitor's own, the server's, and the required ones once he tried to buy. */
    errors: { ...(showMissing ? Object.fromEntries(missing.map((i) => [i.id, isUpload(i) ? t.uploadFirst(i.label) : t.typeFirst(i.label)])) : {}), ...errors } as Record<number, string>,
    setText,
    upload,
    removeFile,
    missing,
    uploading,
    /** The extra price of what's filled. */
    delta: list.reduce((sum, i) => sum + (filled(i) ? i.price_delta : 0), 0),
    /** Marks the required fields left empty; true when everything is ready. */
    check: () => {
      setShowMissing(true);
      return missing.length === 0 && !uploading;
    },
    /** input id → text or upload token (only the filled ones). */
    payload: (): Record<string, string> => Object.fromEntries(list.filter(filled).map((i) => [String(i.id), (values[i.id] ?? "").trim()])),
    /** "الاسم: أحمد، صورتك: me.jpg" for the cart. */
    label: () =>
      list
        .filter(filled)
        .map((i) => `${i.label}: ${isUpload(i) ? (files[i.id] ?? t.file) : (values[i.id] ?? "").trim()}`)
        .join("، "),
    /** Server errors keyed "inputs.{id}" (or "items.0.inputs.{id}"). */
    setServerErrors: (fieldErrors: Record<string, string>) => {
      const next: Record<number, string> = {};
      for (const [key, message] of Object.entries(fieldErrors)) {
        const m = key.match(/inputs\.(\d+)$/);
        if (m) next[Number(m[1])] = message;
      }
      setErrors((e) => ({ ...e, ...next }));
    },
    reset: () => {
      setValues({});
      setFiles({});
      setErrors({});
      setShowMissing(false);
    },
  };
}

export type CustomerInputsState = ReturnType<typeof useCustomerInputs>;

type Classes = {
  /** Each field's wrapper. */
  field?: string;
  label?: string;
  /** Text inputs, textareas and the upload button. */
  control?: string;
  hint?: string;
  error?: string;
};

/** Draws the fields; the theme gives its own classes (colors, radius, sizes). */
export function CustomerInputFields({ state, classes = {}, className }: { state: CustomerInputsState; classes?: Classes; className?: string }) {
  if (state.list.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {state.list.map((input) => {
        const error = state.errors[input.id];
        const id = `input-${input.id}`;
        return (
          <div key={input.id} id={`inp-${input.id}`} data-field={`inputs.${input.id}`} className={cn("flex flex-col gap-1.5", classes.field)}>
            <label htmlFor={id} className={cn("text-sm font-bold", classes.label)}>
              {input.label}
              {input.is_required ? <span className="text-red-600" aria-hidden> *</span> : null}
              {input.price_delta > 0 ? <span className="ms-1.5 text-xs font-normal opacity-70">(+{formatMoney(input.price_delta)})</span> : null}
            </label>
            {input.kind === "text" ? (
              <input
                id={id}
                value={state.values[input.id] ?? ""}
                onChange={(e) => state.setText(input.id, e.target.value)}
                maxLength={maxLength(input)}
                placeholder={input.placeholder ?? ""}
                aria-invalid={error ? true : undefined}
                className={cn("h-11 rounded-lg border bg-transparent px-3 text-sm", error && "border-red-500", classes.control)}
              />
            ) : input.kind === "textarea" ? (
              <textarea
                id={id}
                rows={3}
                value={state.values[input.id] ?? ""}
                onChange={(e) => state.setText(input.id, e.target.value)}
                maxLength={maxLength(input)}
                placeholder={input.placeholder ?? ""}
                aria-invalid={error ? true : undefined}
                className={cn("rounded-lg border bg-transparent px-3 py-2 text-sm", error && "border-red-500", classes.control)}
              />
            ) : (
              <UploadField input={input} state={state} id={id} error={Boolean(error)} classes={classes} />
            )}
            {error ? (
              <p className={cn("text-xs font-bold text-red-600", classes.error)} role="alert">
                {error}
              </p>
            ) : isUpload(input) && !state.files[input.id] ? (
              <p className={cn("text-xs opacity-70", classes.hint)}>{input.kind === "image" ? t.imageHint : t.fileHint}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function UploadField({ input, state, id, error, classes }: { input: ProductInput; state: CustomerInputsState; id: string; error: boolean; classes: Classes }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const name = state.files[input.id];
  const busy = state.busy[input.id];
  const Icon = input.kind === "image" ? ImagePlus : FileUp;

  return (
    <div className="flex items-center gap-2">
      <input
        ref={ref}
        id={id}
        type="file"
        accept={input.kind === "image" ? IMAGE_ACCEPT : FILE_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void state.upload(input, file);
        }}
      />
      {name ? (
        <span className={cn("flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 text-sm", classes.control)}>
          <Paperclip className="size-4 shrink-0 opacity-70" aria-hidden />
          <span className="truncate" dir="ltr">
            {name}
          </span>
          <button type="button" onClick={() => state.removeFile(input.id)} className="ms-auto shrink-0 rounded p-1 opacity-70 hover:opacity-100" aria-label={t.remove(name)}>
            <X className="size-4" aria-hidden />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className={cn("flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-dashed px-3 text-sm font-semibold disabled:opacity-60", error && "border-red-500", classes.control)}
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icon className="size-4" aria-hidden />}
          {busy ? t.uploading : input.kind === "image" ? t.chooseImage : t.chooseFile}
        </button>
      )}
    </div>
  );
}
