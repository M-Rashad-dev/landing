"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, ListPlus, PackagePlus, Plus, RefreshCw, Trash2 } from "lucide-react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Controller, FormProvider, useFieldArray, useForm, useFormContext } from "react-hook-form";
import { z } from "zod";
import { FormSection, SaveBar, useUnsavedWarning } from "@/components/forms/form-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Alert, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/session-context";
import { zRequiredString } from "@/lib/validation";
import { ar } from "@/messages/ar";
import { ApplyDialog } from "./apply-dialog";
import { createSpecGroup, deleteSpecGroup, MAX_CARD_ROWS, MAX_ROWS, pushSpecGroup, specKey, updateSpecGroup, useRefreshSpecs, useSpecGroup, type SpecGroup } from "./api";
import { FillGrid } from "./fill-grid";

const t = ar.specs.group;

const schema = z
  .object({
    name: zRequiredString(60),
    rows: z
      .array(
        z.object({
          label: zRequiredString(60),
          in_card: z.boolean(),
          filterable: z.boolean(),
        }),
      )
      .min(1, ar.validation.required)
      .max(MAX_ROWS, t.maxRows),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    let cards = 0;
    value.rows.forEach((row, i) => {
      const key = specKey(row.label);
      if (key && seen.has(key))
        ctx.addIssue({
          code: "custom",
          path: ["rows", i, "label"],
          message: t.duplicate,
        });
      seen.add(key);
      if (row.in_card && ++cards > MAX_CARD_ROWS)
        ctx.addIssue({
          code: "custom",
          path: ["rows", i, "in_card"],
          message: t.tooManyCard,
        });
    });
  });

type Values = z.infer<typeof schema>;

const EMPTY_ROW = { label: "", in_card: false, filterable: false };

function fromGroup(group: SpecGroup | null, example: string | null): Values {
  if (group) return { name: group.name, rows: group.rows.map((r) => ({ ...r })) };
  const sample = ar.specs.groups.examples.find((e) => e.key === example);
  if (sample)
    return {
      name: sample.name,
      rows: sample.rows.map((label) => ({
        label,
        in_card: (sample.card as readonly string[]).includes(label),
        filterable: false,
      })),
    };
  return { name: "", rows: [{ ...EMPTY_ROW }] };
}

/** A new group, or an existing one with its tabs «الصفوف» | «املأ القيم». */
export function GroupPage({ id }: { id: number | null }) {
  const query = useSpecGroup(id);
  const search = useSearchParams();

  if (id !== null && (!Number.isInteger(id) || id <= 0 || (query.isError && isApiError(query.error) && query.error.status === 404))) notFound();
  if (id !== null && query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (id !== null && query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;

  const group = id !== null ? (query.data ?? null) : null;
  return <GroupScreen key={group?.id ?? "new"} group={group} example={search.get("example")} />;
}

function GroupScreen({ group, example }: { group: SpecGroup | null; example: string | null }) {
  const [tab, setTab] = React.useState("rows");
  const crumbs = [{ label: t.back, href: "/dashboard/catalog/spec-groups" }, { label: group?.name ?? t.newTitle }];

  if (!group) {
    return (
      <>
        <PageHeader crumbs={crumbs} title={t.newTitle} />
        <RowsForm group={null} example={example} />
      </>
    );
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageHeader
        crumbs={crumbs}
        title={group.name}
        description={t.usedBy(group.products_count)}
        tabs={
          <TabsList>
            <TabsTrigger value="rows">{t.tabs.rows}</TabsTrigger>
            <TabsTrigger value="grid" count={group.products_count}>
              {t.tabs.grid}
            </TabsTrigger>
          </TabsList>
        }
      />
      <TabsContent value="rows">
        <RowsForm group={group} example={null} />
      </TabsContent>
      <TabsContent value="grid">
        <FillGrid group={group} />
      </TabsContent>
    </Tabs>
  );
}

function RowsForm({ group, example }: { group: SpecGroup | null; example: string | null }) {
  const router = useRouter();
  const can = useCan();
  const refresh = useRefreshSpecs();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState(false);
  const [pushing, setPushing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: fromGroup(group, example),
    mode: "onTouched",
  });
  const { errors, isDirty, isSubmitting } = form.formState;
  useUnsavedWarning(isDirty && !isSubmitting);
  const canEdit = can(group ? "products.update" : "products.create");

  async function onSubmit(values: Values) {
    setFormError(null);
    const body = {
      name: values.name.trim(),
      rows: values.rows.map((r) => ({ ...r, label: r.label.trim() })),
    };
    try {
      const saved = group ? await updateSpecGroup(group.id, body) : await createSpecGroup(body);
      toast.success(group ? t.saved : t.created);
      await refresh();
      if (group) form.reset({ name: saved.name, rows: saved.rows });
      else router.replace(`/dashboard/catalog/spec-groups/${saved.id}`);
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, ["name", "rows"]);
      if (unmatched.length || !(isApiError(error) && error.isValidation)) setFormError(unmatched[0] ?? errorMessage(error));
    }
  }

  async function onPush() {
    if (!group) return;
    setBusy(true);
    try {
      const { updated } = await pushSpecGroup(group.id);
      toast.success(t.pushed(updated));
      await refresh();
      setPushing(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!group) return;
    setBusy(true);
    try {
      await deleteSpecGroup(group.id);
      toast.success(t.deleted);
      await refresh();
      router.replace("/dashboard/catalog/spec-groups");
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  const submit = form.handleSubmit(onSubmit, () => toast.error(ar.common.errorTitle));

  return (
    <FormProvider {...form}>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex max-w-3xl flex-col gap-4">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}

        {group && can("products.update") ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setApplying(true)}>
              <PackagePlus />
              {t.apply}
            </Button>
            <Button type="button" variant="outline" onClick={() => (isDirty ? toast.error(t.saveFirst) : setPushing(true))} disabled={group.products_count === 0}>
              <RefreshCw />
              {t.push}
            </Button>
          </div>
        ) : null}

        <FormSection title={t.name}>
          <Field label={t.name} htmlFor="group-name" error={errors.name?.message} required>
            <Input id="group-name" placeholder={t.namePlaceholder} maxLength={60} aria-invalid={!!errors.name} disabled={!canEdit} {...form.register("name")} />
          </Field>
        </FormSection>

        <FormSection title={t.rowsTitle} description={t.rowsHint} hasError={!!errors.rows}>
          <RowsList disabled={!canEdit} />
          <Alert tone="info">{t.filterHint}</Alert>
        </FormSection>

        {group && can("products.delete") ? (
          <div>
            <Button type="button" variant="danger-ghost" onClick={() => setDeleting(true)}>
              <Trash2 />
              {t.delete}
            </Button>
          </div>
        ) : null}

        {canEdit ? <SaveBar visible={isDirty || !group} saving={isSubmitting} onSave={() => void submit()} onDiscard={group ? () => form.reset() : undefined} /> : null}
      </form>

      {group ? <ApplyDialog group={group} open={applying} onOpenChange={setApplying} /> : null}
      <ConfirmDialog open={pushing} onOpenChange={setPushing} title={t.pushTitle} description={t.pushText} confirmLabel={t.pushConfirm} loading={busy} onConfirm={() => void onPush()} />
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title={t.deleteTitle} description={t.deleteText} confirmLabel={t.delete} destructive loading={busy} onConfirm={() => void onDelete()} />
    </FormProvider>
  );
}

function RowsList({ disabled }: { disabled: boolean }) {
  const { control, register, formState } = useFormContext<Values>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "rows",
  });
  const errors = formState.errors.rows;

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2">
        {fields.map((field, index) => {
          const rowErrors = errors?.[index];
          return (
            <li key={field.id} className="rounded-xl border border-border bg-surface-2/40 p-3">
              <div className="flex items-start gap-2">
                <Badge tone="neutral" size="sm" className="mt-2.5 tabular">
                  {index + 1}
                </Badge>
                <div className="min-w-0 flex-1">
                  <Input aria-label={t.label} placeholder={t.labelPlaceholder} maxLength={60} aria-invalid={!!rowErrors?.label} disabled={disabled} {...register(`rows.${index}.label`)} />
                  {rowErrors?.label?.message ? <p className="mt-1 text-xs text-danger">{rowErrors.label.message}</p> : null}
                </div>
                <div className="flex shrink-0 items-center">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={t.moveUp} disabled={disabled || index === 0} onClick={() => move(index, index - 1)}>
                    <ArrowUp />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={t.moveDown} disabled={disabled || index === fields.length - 1} onClick={() => move(index, index + 1)}>
                    <ArrowDown />
                  </Button>
                  <Button type="button" variant="danger-ghost" size="icon-sm" aria-label={t.removeRow} disabled={disabled || fields.length === 1} onClick={() => remove(index)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 ps-9">
                {(["in_card", "filterable"] as const).map((flag) => (
                  <Controller
                    key={flag}
                    control={control}
                    name={`rows.${index}.${flag}`}
                    render={({ field: f }) => (
                      <label className="flex items-center gap-2 text-[13px] text-ink-2">
                        <Switch checked={f.value} onCheckedChange={f.onChange} disabled={disabled} />
                        {flag === "in_card" ? t.inCard : t.filterable}
                      </label>
                    )}
                  />
                ))}
              </div>
              {rowErrors?.in_card?.message ? <p className="mt-1 ps-9 text-xs text-danger">{rowErrors.in_card.message}</p> : null}
            </li>
          );
        })}
      </ol>
      {errors?.root?.message || errors?.message ? <p className="text-xs text-danger">{errors.root?.message ?? errors.message}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={disabled || fields.length >= MAX_ROWS} onClick={() => append({ ...EMPTY_ROW }, { shouldFocus: true })}>
          {fields.length === 0 ? <Plus /> : <ListPlus />}
          {t.addRow}
        </Button>
        <span className="text-xs text-ink-3">{t.inCardHint}</span>
      </div>
    </div>
  );
}
