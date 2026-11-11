"use client";

import { ImagePlus, Minus, Plus, Upload, X } from "lucide-react";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/tabs";
import { controlClass, InputGroup, Textarea } from "@/components/ui/input";
import { CURRENCY } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.showcase.inputs;

/** Money: Latin digits, up to 2 decimals, the currency on the end side. `signed` allows "-20". */
export function MoneyInput({ value, onChange, signed = false, ...props }: Omit<React.ComponentProps<"input">, "value" | "onChange"> & { value: string; onChange: (v: string) => void; signed?: boolean }) {
  const pattern = signed ? /^-?\d{0,7}(\.\d{0,2})?$/ : /^\d{0,7}(\.\d{0,2})?$/;
  return (
    <InputGroup
      ltr
      inputMode="decimal"
      inputClassName="tabular"
      end={CURRENCY}
      value={value}
      onChange={(e) => {
        const next = e.target.value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
        if (next === "" || pattern.test(next)) onChange(next);
      }}
      {...props}
    />
  );
}

/** Egyptian mobile, typed as 01xxxxxxxxx. */
export function PhoneInput(props: React.ComponentProps<"input">) {
  return <InputGroup ltr type="tel" inputMode="tel" autoComplete="tel" placeholder="01xxxxxxxxx" inputClassName="tabular" maxLength={14} {...props} />;
}

export function QuantityStepper({ value, onChange, min = 1, max = 99, disabled }: { value: number; onChange: (v: number) => void; min?: number; max?: number; disabled?: boolean }) {
  return (
    <div className="inline-flex h-9 items-center rounded-lg border border-border-strong bg-surface" role="group" aria-label={t.quantity}>
      <button type="button" className="flex size-9 items-center justify-center text-ink-2 hover:text-ink disabled:opacity-40" disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label={t.increase}>
        <Plus className="size-4" />
      </button>
      <span className="tabular w-10 text-center text-sm font-semibold" aria-live="polite">
        {value}
      </span>
      <button type="button" className="flex size-9 items-center justify-center text-ink-2 hover:text-ink disabled:opacity-40" disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label={t.decrease}>
        <Minus className="size-4" />
      </button>
    </div>
  );
}

/** #RRGGBB with a swatch picker. */
export function ColorInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <div className="flex items-center gap-2">
      <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border-strong" style={{ background: value || "#ffffff" }}>
        <input type="color" value={value || "#ffffff"} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" aria-label={t.color} />
      </label>
      <input id={id} dir="ltr" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} maxLength={7} placeholder="#F26B1D" className={cn(controlClass, "tabular h-9 w-28 px-3 text-sm")} />
    </div>
  );
}

/** Drop a file or click (receipts, CSV, images); previews images. */
export function FileDrop({ accept, file, onFile, hint, invalid }: { accept: string; file: File | null; onFile: (f: File | null) => void; hint?: string; invalid?: boolean }) {
  const [over, setOver] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const id = React.useId();

  React.useEffect(() => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URL tied to the chosen file
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files[0] ?? null);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-[13px] text-ink-3 transition-colors",
        over ? "border-brand bg-brand-soft/50" : invalid ? "border-danger" : "border-border-strong hover:bg-surface-2/60",
      )}
    >
      {file && preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- local preview
        <img src={preview} alt="" className="max-h-40 rounded-lg object-contain" />
      ) : (
        <Upload className="size-5" aria-hidden />
      )}
      <span className="font-semibold text-ink">{file ? file.name : ar.common.dropHere}</span>
      {hint ? <span>{hint}</span> : null}
      {file ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onFile(null);
            setPreview(null);
          }}
          className="text-xs font-semibold text-danger"
        >
          {ar.common.delete}
        </button>
      ) : null}
      <input id={id} type="file" accept={accept} className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </label>
  );
}

/** Media library field: picked images as tiles, the first is the main one. */
export function MediaTiles({ images, onRemove, onAdd, max = 10 }: { images: Array<{ id: number; url: string }>; onRemove: (id: number) => void; onAdd: () => void; max?: number }) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {images.map((img, i) => (
        <li key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- media thumbnail */}
          <img src={img.url} alt="" className="size-full object-cover" />
          {i === 0 ? (
            <Badge tone="ink" size="sm" className="absolute start-1.5 top-1.5">
              {t.mainImage}
            </Badge>
          ) : null}
          <button type="button" onClick={() => onRemove(img.id)} className="absolute end-1.5 top-1.5 rounded-md bg-surface/90 p-1 text-ink-2 opacity-0 shadow-sm transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100" aria-label={ar.common.delete}>
            <X className="size-3.5" />
          </button>
        </li>
      ))}
      {images.length < max ? (
        <li>
          <button type="button" onClick={onAdd} className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong text-xs text-ink-3 hover:bg-surface-2/60 hover:text-ink">
            <ImagePlus className="size-5" />
            {ar.common.add}
          </button>
        </li>
      ) : null}
    </ul>
  );
}

/** Markdown with write / preview (product description, store pages). */
export function MarkdownEditor({ value, onChange, rows = 8, id }: { value: string; onChange: (v: string) => void; rows?: number; id?: string }) {
  const [mode, setMode] = React.useState<"write" | "preview">("write");
  return (
    <div className="flex flex-col gap-2">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "write", label: t.write },
          { value: "preview", label: t.preview },
        ]}
        className="self-start"
      />
      {mode === "write" ? (
        <Textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <div className="min-h-32 rounded-lg border border-border bg-surface-2/50 p-3 text-sm leading-relaxed [&_a]:text-brand-strong [&_a]:underline [&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:font-bold [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:ps-5">
          <ReactMarkdown>{value || "—"}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
