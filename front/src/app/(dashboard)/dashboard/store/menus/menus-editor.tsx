"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, CornerDownLeft, Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { z } from "zod";
import { ErrorState } from "@/components/dashboard/error-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { applyServerErrors, errorMessage } from "@/lib/api/errors";
import { safeHref } from "@/lib/links";
import { usePages } from "@/lib/pages/api";
import { useProducts } from "@/lib/products/api";
import { storeKeys, updateStore, useCategories, useStore, useStorePages, type DashboardStore, type MenuItem, type MenuType } from "@/lib/store/api";
import { ar } from "@/messages/ar";

const t = ar.store.menus;
const TYPES: MenuType[] = ["home", "all_products", "category", "product", "page", "landing", "url"];
const NEEDS_TARGET: MenuType[] = ["category", "product", "page", "landing"];

const leaf = z
  .object({
    type: z.enum(["home", "all_products", "category", "product", "page", "landing", "url"]),
    label: z.string().trim().min(1, ar.validation.required).max(40, ar.validation.max(40)),
    target_id: z.string(),
    url: z.string().trim().max(500),
  })
  .superRefine((item, ctx) => {
    if (NEEDS_TARGET.includes(item.type) && !item.target_id) ctx.addIssue({ code: "custom", path: ["target_id"], message: ar.validation.required });
    if (item.type === "url" && !safeHref(item.url)) ctx.addIssue({ code: "custom", path: ["url"], message: ar.fields.invalidLink });
  });

const schema = z.object({
  header: z.array(z.intersection(leaf, z.object({ children: z.array(leaf).max(12) }))).max(12),
  footer: z.array(leaf).max(20),
});
type Values = z.infer<typeof schema>;
type LeafValues = z.infer<typeof leaf>;

const toLeaf = (item: MenuItem): LeafValues => ({ type: item.type, label: item.label, target_id: item.target_id ? String(item.target_id) : "", url: item.url ?? "" });
const fromLeaf = (item: LeafValues): MenuItem => ({
  type: item.type,
  label: item.label.trim(),
  target_id: NEEDS_TARGET.includes(item.type) ? Number(item.target_id) : null,
  url: item.type === "url" ? item.url.trim() : null,
});
const blank = (): LeafValues => ({ type: "category", label: "", target_id: "", url: "" });

type Targets = Record<"category" | "product" | "page" | "landing", Array<{ value: string; label: string }>>;

export function MenusEditor() {
  const store = useStore();
  const categories = useCategories();
  const pages = useStorePages();
  const products = useProducts({ per_page: 100 });
  const landings = usePages({ status: "published" });

  if (store.isError) return <ErrorState error={store.error} onRetry={() => store.refetch()} />;
  if (store.isPending || !store.data || categories.isPending) return <Skeleton className="h-96 rounded-xl" />;
  if (!store.data.exists) return <p className="text-sm text-muted-foreground">{ar.store.setupText}</p>;

  const targets: Targets = {
    category: (categories.data ?? []).map((c) => ({ value: String(c.id), label: `${"— ".repeat(c.depth)}${c.name}` })),
    product: (products.data?.data ?? []).map((p) => ({ value: String(p.id), label: p.name })),
    page: (pages.data ?? []).map((p) => ({ value: String(p.id), label: p.title })),
    landing: (landings.data?.data ?? []).filter((p) => p.kind !== "store_home").map((p) => ({ value: String(p.id), label: p.title })),
  };
  return <MenusForm key={JSON.stringify(store.data.menus)} store={store.data} targets={targets} />;
}

function MenusForm({ store, targets }: { store: Extract<DashboardStore, { exists: true }>; targets: Targets }) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      header: store.menus.header.map((item) => ({ ...toLeaf(item), children: (item.children ?? []).map(toLeaf) })),
      footer: store.menus.footer.map(toLeaf),
    },
  });
  const { control, register, handleSubmit, formState, setError, reset } = form;
  const header = useFieldArray({ control, name: "header" });
  const footer = useFieldArray({ control, name: "footer" });

  async function onSubmit(v: Values) {
    try {
      const saved = await updateStore({
        menus: { header: v.header.map((item) => ({ ...fromLeaf(item), children: item.children.map(fromLeaf) })), footer: v.footer.map(fromLeaf) },
      });
      queryClient.setQueryData(storeKeys.store, saved);
      reset(v);
      toast.success(t.saved);
    } catch (err) {
      const unmatched = applyServerErrors(err, setError, ["header", "footer"]);
      toast.error(unmatched[0] ?? errorMessage(err));
    }
  }

  function fillFromCategories() {
    const tops = targets.category.filter((c) => !c.label.startsWith("—")).slice(0, 8);
    header.replace(tops.map((c) => ({ type: "category" as const, label: c.label.slice(0, 40), target_id: c.value, url: "", children: [] })));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 pb-20">
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">{t.header}</h2>
          {targets.category.length > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={fillFromCategories}>
              {t.fromCategories}
            </Button>
          ) : null}
        </div>
        {header.fields.length === 0 ? <p className="text-sm text-muted-foreground">{t.empty}</p> : null}
        {header.fields.map((field, index) => (
          <div key={field.id} className="rounded-xl border bg-muted/30 p-3">
            <ItemRow
              control={control}
              register={register}
              errors={formState.errors}
              path={`header.${index}`}
              targets={targets}
              onUp={index > 0 ? () => header.move(index, index - 1) : undefined}
              onDown={index < header.fields.length - 1 ? () => header.move(index, index + 1) : undefined}
              onRemove={() => header.remove(index)}
            />
            <Children control={control} register={register} errors={formState.errors} index={index} targets={targets} />
          </div>
        ))}
        <Button type="button" variant="outline" className="self-start" disabled={header.fields.length >= 12} onClick={() => header.append({ ...blank(), children: [] })}>
          <Plus />
          {t.add}
        </Button>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-bold">{t.footer}</h2>
        {footer.fields.length === 0 ? <p className="text-sm text-muted-foreground">{t.emptyFooter}</p> : null}
        {footer.fields.map((field, index) => (
          <div key={field.id} className="rounded-xl border bg-muted/30 p-3">
            <ItemRow
              control={control}
              register={register}
              errors={formState.errors}
              path={`footer.${index}`}
              targets={targets}
              onUp={index > 0 ? () => footer.move(index, index - 1) : undefined}
              onDown={index < footer.fields.length - 1 ? () => footer.move(index, index + 1) : undefined}
              onRemove={() => footer.remove(index)}
            />
          </div>
        ))}
        <Button type="button" variant="outline" className="self-start" disabled={footer.fields.length >= 20} onClick={() => footer.append({ ...blank(), type: "page" })}>
          <Plus />
          {t.add}
        </Button>
      </Card>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button type="submit" size="lg" loading={formState.isSubmitting} disabled={!formState.isDirty} className="shadow-lg">
          {ar.common.save}
        </Button>
      </div>
    </form>
  );
}

type ItemPath = `header.${number}` | `footer.${number}` | `header.${number}.children.${number}`;

function getErrors(errors: FieldErrors<Values>, path: ItemPath): FieldErrors<LeafValues> | undefined {
  const parts = path.split(".");
  let node: unknown = errors;
  for (const part of parts) node = (node as Record<string, unknown> | undefined)?.[part];
  return node as FieldErrors<LeafValues> | undefined;
}

function ItemRow({
  control,
  register,
  errors,
  path,
  targets,
  onUp,
  onDown,
  onRemove,
}: {
  control: Control<Values>;
  register: UseFormRegister<Values>;
  errors: FieldErrors<Values>;
  path: ItemPath;
  targets: Targets;
  onUp?: () => void;
  onDown?: () => void;
  onRemove: () => void;
}) {
  const type = useWatch({ control, name: `${path}.type` as `header.${number}.type` }) as MenuType;
  const e = getErrors(errors, path);
  const needsTarget = NEEDS_TARGET.includes(type);

  return (
    <div className="flex flex-wrap items-start gap-2">
      <div className="w-36">
        <Controller
          control={control}
          name={`${path}.type` as `header.${number}.type`}
          render={({ field }) => <Select aria-label={t.type} value={field.value} onChange={(event) => field.onChange(event.target.value)} options={TYPES.map((value) => ({ value, label: t.types[value] }))} />}
        />
      </div>
      <div className="min-w-32 flex-1">
        <Input aria-label={t.label} placeholder={t.label} maxLength={40} aria-invalid={!!e?.label} {...register(`${path}.label` as `header.${number}.label`)} />
        {e?.label?.message ? <p className="mt-1 text-xs text-destructive">{e.label.message}</p> : null}
      </div>
      {needsTarget ? (
        <div className="min-w-40 flex-1">
          <Controller
            control={control}
            name={`${path}.target_id` as `header.${number}.target_id`}
            render={({ field }) => (
              <Select aria-label={t.target} value={field.value} placeholder={t.target} onChange={(event) => field.onChange(event.target.value)} options={targets[type as keyof Targets]} aria-invalid={!!e?.target_id} />
            )}
          />
          {e?.target_id?.message ? <p className="mt-1 text-xs text-destructive">{e.target_id.message}</p> : null}
        </div>
      ) : null}
      {type === "url" ? (
        <div className="min-w-40 flex-1">
          <Input aria-label={t.url} dir="ltr" className="text-start" placeholder="https://" aria-invalid={!!e?.url} {...register(`${path}.url` as `header.${number}.url`)} />
          {e?.url?.message ? <p className="mt-1 text-xs text-destructive">{e.url.message}</p> : null}
        </div>
      ) : null}
      <div className="flex">
        <Button type="button" variant="ghost" size="icon-sm" disabled={!onUp} onClick={onUp} aria-label={ar.store.categories.moveUp}>
          <ArrowUp />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={!onDown} onClick={onDown} aria-label={ar.store.categories.moveDown}>
          <ArrowDown />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" onClick={onRemove} aria-label={ar.common.delete}>
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

function Children({ control, register, errors, index, targets }: { control: Control<Values>; register: UseFormRegister<Values>; errors: FieldErrors<Values>; index: number; targets: Targets }) {
  const children = useFieldArray({ control, name: `header.${index}.children` });
  return (
    <div className="mt-2 flex flex-col gap-2 ps-6">
      {children.fields.map((field, i) => (
        <div key={field.id} className="flex items-start gap-1">
          <CornerDownLeft className="mt-3 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="flex-1">
            <ItemRow
              control={control}
              register={register}
              errors={errors}
              path={`header.${index}.children.${i}`}
              targets={targets}
              onUp={i > 0 ? () => children.move(i, i - 1) : undefined}
              onDown={i < children.fields.length - 1 ? () => children.move(i, i + 1) : undefined}
              onRemove={() => children.remove(i)}
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="self-start" disabled={children.fields.length >= 12} onClick={() => children.append(blank())}>
        <Plus />
        {t.addChild}
      </Button>
    </div>
  );
}
