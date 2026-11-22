"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, FileText, Plus, Trash2, Upload } from "lucide-react";
import * as React from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioCards } from "@/components/ui/choice";
import { Alert, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { api, apiUpload } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import type { DeliveryType, ProductDetail, ProductFileRow } from "./api";
import type { ProductValues } from "./form-model";

const t = ar.catalog.form.digital;
const TYPES: DeliveryType[] = ["files", "codes", "links", "services"];
const MAX_BYTES = 100 * 1024 * 1024;

/** «منتج رقمي»: a normal product, or one delivered by email after payment (files, codes, a link, a service). */
export function DigitalEditor({ product }: { product: ProductDetail | null }) {
  const { control, register, formState } = useFormContext<ProductValues>();
  const [kind, type] = useWatch({ control, name: ["kind", "delivery_type"] });
  const errors = formState.errors;

  return (
    <div className="flex flex-col gap-4">
      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <RadioCards
            name="kind"
            value={field.value}
            onValueChange={field.onChange}
            options={[
              { value: "physical", title: t.physical, description: t.physicalHint },
              { value: "digital", title: t.digital, description: t.digitalHint },
            ]}
          />
        )}
      />
      {kind === "digital" ? (
        <>
          <Alert tone="info">{t.prepaidNote}</Alert>
          <Field label={t.type} error={errors.delivery_type?.message}>
            <Controller control={control} name="delivery_type" render={({ field }) => <RadioCards name="delivery_type" value={field.value} onValueChange={field.onChange} options={TYPES.map((k) => ({ value: k, title: t.types[k], description: t.typeHints[k] }))} />} />
          </Field>

          {type === "files" ? (
            <>
              <Field label={t.downloads} htmlFor="dg-downloads" hint={t.downloadsHint} error={errors.downloads?.message} optional>
                <Input id="dg-downloads" inputMode="numeric" className="max-w-40" placeholder={t.unlimited} {...register("downloads")} />
              </Field>
              {product ? <FilesManager product={product} /> : <p className="text-sm text-ink-3">{t.saveFirst}</p>}
            </>
          ) : null}
          {type === "codes" ? product ? <CodesManager productId={product.id} /> : <p className="text-sm text-ink-3">{t.saveFirst}</p> : null}
          {type === "links" ? (
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <Field label={t.link} htmlFor="dg-link" hint={t.linkHint} error={errors.link?.message} required>
                <Input id="dg-link" dir="ltr" placeholder="https://" {...register("link")} />
              </Field>
              <Field label={t.opens} htmlFor="dg-opens" error={errors.opens?.message} optional>
                <Input id="dg-opens" inputMode="numeric" placeholder={t.unlimited} {...register("opens")} />
              </Field>
            </div>
          ) : null}
          {type === "services" ? <Alert tone="info">{t.servicesHint}</Alert> : null}

          {type ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2/40 p-4">
              <p className="text-sm font-semibold">{t.messageTitle}</p>
              <p className="text-xs text-ink-3">{t.messageHint}</p>
              <Field label={t.subject} htmlFor="dg-subject" error={errors.subject?.message} optional>
                <Input id="dg-subject" placeholder={t.subjectPlaceholder} {...register("subject")} />
              </Field>
              <Field label={t.message} htmlFor="dg-message" error={errors.message?.message} optional>
                <Textarea id="dg-message" rows={4} placeholder={t.messagePlaceholder[type]} {...register("message")} />
              </Field>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Each file with the name the customer sees; «+» adds another (sent right away, ≤ 100 MB). */
function FilesManager({ product }: { product: ProductDetail }) {
  const [files, setFiles] = React.useState<ProductFileRow[]>(product.files ?? []);
  const [name, setName] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  const upload = async () => {
    setError(null);
    if (!file) return setError(t.fileRequired);
    if (!name.trim()) return setError(t.fileNameRequired);
    if (file.size > MAX_BYTES) return setError(t.fileTooBig);
    const form = new FormData();
    form.set("name", name.trim());
    form.set("file", file, file.name);
    setProgress(0);
    try {
      const saved = await apiUpload<ProductFileRow>(`/dashboard/products/${product.id}/files`, form, setProgress);
      setFiles((f) => [...f, saved]);
      setName("");
      setFile(null);
      toast.success(t.fileAdded);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setProgress(null);
    }
  };

  const remove = async (id: number) => {
    try {
      await api(`/dashboard/products/${product.id}/files/${id}`, { method: "DELETE" });
      setFiles((f) => f.filter((x) => x.id !== id));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const rename = async (row: ProductFileRow, next: string) => {
    if (!next.trim() || next.trim() === row.name) return;
    try {
      const saved = await api<ProductFileRow>(`/dashboard/products/${product.id}/files/${row.id}`, { method: "PUT", body: { name: next.trim() } });
      setFiles((f) => f.map((x) => (x.id === row.id ? saved : x)));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{t.files}</p>
      {files.length === 0 ? <p className="text-xs text-ink-3">{t.noFiles}</p> : null}
      <ul className="flex flex-col gap-2">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2">
            <FileText className="size-4 shrink-0 text-ink-3" aria-hidden />
            <Input defaultValue={f.name} aria-label={t.fileName} className="h-8 flex-1" onBlur={(e) => void rename(f, e.target.value)} />
            <span className="hidden shrink-0 text-xs text-ink-3 sm:inline" dir="ltr">
              {f.original_name} · {(f.size / 1048576).toFixed(1)} MB
            </span>
            <Button type="button" variant="ghost" size="icon" aria-label={t.removeFile} onClick={() => void remove(f.id)}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      {files.length < 10 ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-2">
          <Field label={t.fileName} htmlFor="dg-file-name" className="min-w-40 flex-1">
            <Input id="dg-file-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.fileNamePlaceholder} />
          </Field>
          <input ref={input} type="file" className="sr-only" aria-label={t.chooseFile} onChange={(e) => (setFile(e.target.files?.[0] ?? null), (e.target.value = ""))} />
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
            <Upload />
            <span className="max-w-40 truncate">{file ? file.name : t.chooseFile}</span>
          </Button>
          <Button type="button" size="sm" loading={progress !== null} onClick={() => void upload()}>
            <Plus />
            {progress !== null ? `${progress}%` : t.addFile}
          </Button>
          {error ? <p className="w-full text-xs text-danger">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

type CodesState = { combinations: Array<{ key: string; label: string; left: number; count: number }>; codes: Array<{ id: number; code: string; uses_total: number; uses_left: number }> };

/** The entries sent to buyers, in order (each one up to its uses); paste many at once. */
function CodesManager({ productId }: { productId: number }) {
  const client = useQueryClient();
  const [key, setKey] = React.useState<string | null>(null);
  const query = useQuery({ queryKey: ["product-codes", productId, key], queryFn: () => api<CodesState>(`/dashboard/products/${productId}/codes${key ? `?combination_key=${encodeURIComponent(key)}` : ""}`) });
  const [text, setText] = React.useState("");
  const [split, setSplit] = React.useState<"line" | "blank">("line");
  const [uses, setUses] = React.useState("1");
  const [busy, setBusy] = React.useState(false);
  const data = query.data;
  const combos = data?.combinations ?? [];
  const current = key ?? combos[0]?.key ?? "";
  const keep = (next: CodesState) => client.setQueryData(["product-codes", productId, key], next);
  const body = (extra: Record<string, unknown>) => ({ combination_key: current, ...extra });

  const entries = (split === "line" ? text.split(/\r?\n/) : text.split(/\r?\n\s*\r?\n/)).map((s) => s.trim()).filter(Boolean);

  const add = async () => {
    if (entries.length === 0) return;
    setBusy(true);
    try {
      keep(await api<CodesState>(`/dashboard/products/${productId}/codes`, { method: "POST", body: body({ codes: entries.map((code) => ({ code, uses: Number(uses) || 1 })) }) }));
      setText("");
      toast.success(t.codesAdded(entries.length));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, by: -1 | 1) => {
    if (!data) return;
    const ids = data.codes.map((c) => c.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved);
    try {
      keep(await api<CodesState>(`/dashboard/products/${productId}/codes/order`, { method: "PUT", body: body({ ids }) }));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const remove = async (id: number) => {
    try {
      await api(`/dashboard/products/${productId}/codes/${id}`, { method: "DELETE" });
      void query.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const setLeft = async (row: CodesState["codes"][number], left: number) => {
    if (left === row.uses_left || left < 0) return;
    try {
      keep(await api<CodesState>(`/dashboard/products/${productId}/codes/${row.id}`, { method: "PUT", body: { code: row.code, uses_left: left } }));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const combo = combos.find((c) => c.key === current);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t.codes}</p>
        {combo ? <Badge tone={combo.left > 0 ? "success" : "danger"}>{t.codesLeft(combo.left)}</Badge> : null}
      </div>
      {combos.length > 1 ? (
        <Field label={t.combination} htmlFor="dg-combo" hint={t.combinationHint}>
          <Select id="dg-combo" value={current} onValueChange={setKey} options={combos.map((c) => ({ value: c.key, label: `${c.label} (${c.left})` }))} />
        </Field>
      ) : null}
      {data && data.codes.length > 0 ? (
        <ol className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
          {data.codes.map((c, i) => (
            <li key={c.id} className="flex items-start gap-2 rounded-lg border border-border bg-surface p-2 text-sm">
              <span className="mt-1 w-6 shrink-0 text-center text-xs text-ink-3 tabular">{i + 1}</span>
              <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs" dir="ltr">
                {c.code}
              </pre>
              <label className="flex shrink-0 items-center gap-1 text-xs text-ink-3">
                {t.usesLeft}
                <Input type="number" min={0} defaultValue={c.uses_left} className="h-7 w-16" onBlur={(e) => void setLeft(c, Number(e.target.value))} aria-label={t.usesLeft} />
              </label>
              <span className="flex shrink-0">
                <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => void move(i, -1)} aria-label={t.up}>
                  <ArrowUp />
                </Button>
                <Button type="button" variant="ghost" size="icon" disabled={i === data.codes.length - 1} onClick={() => void move(i, 1)} aria-label={t.down}>
                  <ArrowDown />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => void remove(c.id)} aria-label={t.removeCode}>
                  <Trash2 />
                </Button>
              </span>
            </li>
          ))}
        </ol>
      ) : query.isSuccess ? (
        <p className="text-xs text-ink-3">{t.noCodes}</p>
      ) : null}
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
        <Field label={t.addCodes} htmlFor="dg-codes" hint={split === "line" ? t.oneLine : t.blankLine}>
          <Textarea id="dg-codes" rows={4} dir="ltr" value={text} onChange={(e) => setText(e.target.value)} placeholder={split === "line" ? "ABCD-1234\nEFGH-5678" : "email: a@b.com\npass: 123\n\nemail: c@d.com\npass: 456"} />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <Segmented value={split} onChange={setSplit} options={[{ value: "line", label: t.splitLine }, { value: "blank", label: t.splitBlank }]} />
          <Field label={t.uses} htmlFor="dg-uses" className="w-28">
            <Input id="dg-uses" type="number" min={1} max={1000} value={uses} onChange={(e) => setUses(e.target.value)} />
          </Field>
          <Button type="button" size="sm" loading={busy} disabled={entries.length === 0} onClick={() => void add()}>
            <Plus />
            {t.addCount(entries.length)}
          </Button>
        </div>
      </div>
    </div>
  );
}
