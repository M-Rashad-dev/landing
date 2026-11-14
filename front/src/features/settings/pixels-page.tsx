"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Store } from "lucide-react";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { SaveBar } from "@/components/forms/form-layout";
import { SwitchRow } from "@/components/ui/choice";
import { ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { TRACKING_PATTERNS } from "@/lib/tracking/ids";
import { ar } from "@/messages/ar";

const t = ar.growth.pixels;
export const PIXELS = ["meta_pixel_id", "tiktok_pixel_id", "ga4_id", "gtm_id", "snapchat_pixel_id"] as const;
type PixelKey = (typeof PIXELS)[number];

type Ids = Partial<Record<PixelKey, string | null>> & { conversion_event?: "Purchase" | "Lead" };
type PixelSettings = { store: Ids; landing: Ids; landing_same: boolean };

const id = (key: PixelKey) => z.string().trim().refine((v) => v === "" || TRACKING_PATTERNS[key].test(key === "snapchat_pixel_id" ? v.toLowerCase() : key === "meta_pixel_id" ? v : v.toUpperCase()), t.invalid);
const group = z.object(Object.fromEntries(PIXELS.map((k) => [k, id(k)])) as Record<PixelKey, ReturnType<typeof id>>);
const schema = z.object({ store: group, landing: group, landing_same: z.boolean(), conversion: z.enum(["Purchase", "Lead"]) });
type Values = z.infer<typeof schema>;

const toGroup = (ids: Ids) => Object.fromEntries(PIXELS.map((k) => [k, ids[k] ?? ""])) as Record<PixelKey, string>;
const toValues = (s: PixelSettings): Values => ({ store: toGroup(s.store), landing: toGroup(s.landing), landing_same: s.landing_same, conversion: s.landing.conversion_event === "Lead" ? "Lead" : "Purchase" });
const fromGroup = (g: Record<PixelKey, string>) => Object.fromEntries(PIXELS.map((k) => [k, g[k].trim() || null]));

/** «البيكسلات»: the store's ids, and one set every landing page listens to (or the store's). */
export function PixelsPage() {
  const query = useQuery({ queryKey: ["pixels"], queryFn: () => api<PixelSettings>("/dashboard/pixels") });
  if (query.isPending) return <Skeleton className="h-96 max-w-3xl rounded-xl" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  return <PixelsForm initial={query.data} />;
}

function PixelsForm({ initial }: { initial: PixelSettings }) {
  const client = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(initial) });
  const { errors, isSubmitting, isDirty } = form.formState;
  const same = useWatch({ control: form.control, name: "landing_same" });

  const submit = form.handleSubmit(async (v) => {
    try {
      const saved = await api<PixelSettings>("/dashboard/pixels", { method: "PUT", body: { store: fromGroup(v.store), landing: { ...fromGroup(v.landing), conversion_event: v.conversion }, landing_same: v.landing_same } });
      form.reset(toValues(saved));
      client.setQueryData(["pixels"], saved);
      toast.success(t.saved);
    } catch (error) {
      if (isApiError(error)) {
        for (const [key, messages] of Object.entries(error.errors)) form.setError(key as keyof Values, { message: messages[0] });
      }
      toast.error(errorMessage(error));
    }
  });

  const fields = (prefix: "store" | "landing") => (
    <div className="grid gap-4 sm:grid-cols-2">
      {PIXELS.map((key) => (
        <Field key={key} label={t.names[key]} htmlFor={`${prefix}-${key}`} error={errors[prefix]?.[key]?.message} optional>
          <Input id={`${prefix}-${key}`} dir="ltr" placeholder={t.placeholders[key]} {...form.register(`${prefix}.${key}`)} />
        </Field>
      ))}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-ink-2">{t.description}</p>
      <Panel>
        <PanelHeader title={<span className="flex items-center gap-2"><Store className="size-4 text-ink-3" aria-hidden />{t.store}</span>} description={t.storeHint} />
        <PanelBody>{fields("store")}</PanelBody>
      </Panel>
      <Panel>
        <PanelHeader title={<span className="flex items-center gap-2"><Megaphone className="size-4 text-ink-3" aria-hidden />{t.landing}</span>} description={t.landingHint} />
        <PanelBody className="flex flex-col gap-4">
          <Controller control={form.control} name="landing_same" render={({ field }) => <SwitchRow title={t.same} description={t.sameHint} checked={field.value} onCheckedChange={field.onChange} />} />
          {same ? null : fields("landing")}
          <Field label={t.conversion} hint={t.conversionHint}>
            <Controller control={form.control} name="conversion" render={({ field }) => <Segmented value={field.value} onChange={field.onChange} options={[{ value: "Purchase", label: "Purchase" }, { value: "Lead", label: "Lead" }]} />} />
          </Field>
        </PanelBody>
      </Panel>
      <SaveBar visible={isDirty} saving={isSubmitting} onSave={() => void submit()} onDiscard={() => form.reset()} />
    </form>
  );
}
