"use client";

import { ArrowDown, ArrowUp, Bookmark, Filter, LayoutGrid, Plus, Settings2, Table2, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { toast } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/session-context";
import { ar } from "@/messages/ar";
import { createSpecGroup, MAX_CARD_ROWS, MAX_ROWS, MAX_TABLES, specKey, useRefreshSpecs, useSpecGroups, type SpecGroup } from "../specs/api";
import type { ProductValues } from "./form-model";

const t = ar.specs.product;
const EMPTY_ROW = { label: "", value: "", in_card: false, filterable: false };

/**
 * «المواصفات (اختياري)»: the product's spec tables. «أضف مجموعة» copies a group's rows (the product may then change
 * them for itself), «جدول جديد» is a table for this product only, and «احفظه كمجموعة» turns it into a group.
 */
export function SpecsEditor() {
  const { control } = useFormContext<ProductValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "specs" });
  const specs = useWatch({ control, name: "specs" });
  const groups = useSpecGroups();
  const can = useCan();
  const [adding, setAdding] = React.useState(false);
  const used = new Set(specs.map((s) => s.spec_group_id).filter((id): id is number => id !== null));
  const available = (groups.data?.data ?? []).filter((g) => !used.has(g.id));
  const full = fields.length >= MAX_TABLES;
  const cards = specs.reduce((n, table) => n + table.rows.filter((r) => r.in_card).length, 0);

  async function addGroup(id: string) {
    if (!id) return;
    setAdding(true);
    try {
      const group = await api<SpecGroup>(`/dashboard/spec-groups/${id}`);
      let room = MAX_CARD_ROWS - cards;
      append({
        spec_group_id: group.id,
        name: group.name,
        rows: group.rows.map((r) => {
          const inCard = r.in_card && room > 0;
          if (inCard) room--;
          return {
            label: r.label,
            value: "",
            in_card: inCard,
            filterable: r.filterable,
          };
        }),
      });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAdding(false);
    }
  }

  function newTable() {
    const taken = new Set(specs.map((s) => specKey(s.name)));
    let name: string = t.newTableName;
    for (let i = 2; taken.has(specKey(name)); i++) name = `${t.newTableName} ${i}`;
    append({ spec_group_id: null, name, rows: [{ ...EMPTY_ROW }] }, { shouldFocus: false });
  }

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field, index) => (
        <TableCard key={field.id} index={index} groupName={groups.data?.data.find((g) => g.id === specs[index]?.spec_group_id)?.name ?? null} onRemove={() => remove(index)} />
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value=""
          onValueChange={(v) => void addGroup(v)}
          options={available.map((g) => ({
            value: String(g.id),
            label: g.name,
            hint: ar.specs.groups.rows(g.rows_count),
          }))}
          emptyLabel={available.length === 0 ? t.noGroups : t.addGroup}
          disabled={full || adding || available.length === 0}
          aria-label={t.addGroup}
          className="w-56"
        />
        <Button type="button" variant="outline" size="sm" onClick={newTable} disabled={full}>
          <Plus />
          {t.newTable}
        </Button>
        {can("products.view") ? (
          <Button type="button" variant="link" size="sm" asChild>
            <Link href="/dashboard/catalog/spec-groups">
              <Settings2 />
              {t.manageGroups}
            </Link>
          </Button>
        ) : null}
      </div>
      {full ? <p className="text-xs text-ink-3">{t.maxTables}</p> : null}
    </div>
  );
}

function TableCard({ index, groupName, onRemove }: { index: number; groupName: string | null; onRemove: () => void }) {
  const { control, register, formState, setValue, getValues } = useFormContext<ProductValues>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: `specs.${index}.rows`,
  });
  const groupId = useWatch({ control, name: `specs.${index}.spec_group_id` });
  const can = useCan();
  const refresh = useRefreshSpecs();
  const [saving, setSaving] = React.useState(false);
  const errors = formState.errors.specs?.[index];

  async function saveAsGroup() {
    const table = getValues(`specs.${index}`);
    setSaving(true);
    try {
      const group = await createSpecGroup({
        name: table.name.trim(),
        rows: table.rows
          .filter((r) => r.label.trim())
          .map((r) => ({
            label: r.label.trim(),
            in_card: r.in_card,
            filterable: r.filterable,
          })),
      });
      setValue(`specs.${index}.spec_group_id`, group.id, { shouldDirty: true });
      toast.success(t.savedAsGroup(group.name));
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2/40">
      <div className="flex flex-wrap items-start gap-2 border-b border-border p-3">
        <Table2 className="mt-2.5 size-4 shrink-0 text-ink-3" aria-hidden />
        <div className="min-w-40 flex-1">
          <Input aria-label={t.tableName} maxLength={60} aria-invalid={!!errors?.name} className="font-semibold" {...register(`specs.${index}.name`)} />
          {errors?.name?.message ? <p className="mt-1 text-xs text-danger">{errors.name.message}</p> : null}
          <Badge tone={groupId !== null ? "brand-soft" : "neutral"} size="sm" className="mt-1.5">
            {groupId !== null ? t.fromGroup(groupName ?? "") : t.ownTable}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {groupId === null && can("products.create") ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => void saveAsGroup()} loading={saving}>
              <Bookmark />
              {t.saveAsGroup}
            </Button>
          ) : null}
          <Button type="button" variant="danger-ghost" size="sm" onClick={onRemove}>
            <Trash2 />
            {t.removeTable}
          </Button>
        </div>
      </div>

      <ol className="flex flex-col">
        {fields.map((field, j) => {
          const rowErrors = errors?.rows?.[j];
          return (
            <li key={field.id} className="border-b border-border px-3 py-2.5 last:border-b-0">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
                <div>
                  <Input aria-label={t.label} placeholder={t.label} maxLength={60} aria-invalid={!!rowErrors?.label} {...register(`specs.${index}.rows.${j}.label`)} />
                  {rowErrors?.label?.message ? <p className="mt-1 text-xs text-danger">{rowErrors.label.message}</p> : null}
                </div>
                <div>
                  <Input aria-label={t.value} placeholder={t.valuePlaceholder} maxLength={200} dir="auto" aria-invalid={!!rowErrors?.value} {...register(`specs.${index}.rows.${j}.value`)} />
                  {rowErrors?.value?.message ? <p className="mt-1 text-xs text-danger">{rowErrors.value.message}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Flag index={index} row={j} flag="in_card" />
                  <Flag index={index} row={j} flag="filterable" />
                  <span className="ms-auto flex items-center sm:ms-0">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={ar.specs.group.moveUp} disabled={j === 0} onClick={() => move(j, j - 1)}>
                      <ArrowUp />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={ar.specs.group.moveDown} disabled={j === fields.length - 1} onClick={() => move(j, j + 1)}>
                      <ArrowDown />
                    </Button>
                    <Button type="button" variant="danger-ghost" size="icon-sm" aria-label={ar.specs.group.removeRow} onClick={() => remove(j)}>
                      <Trash2 />
                    </Button>
                  </span>
                </div>
              </div>
              {rowErrors?.in_card?.message ? <p className="mt-1 text-xs text-danger">{rowErrors.in_card.message}</p> : null}
            </li>
          );
        })}
      </ol>
      {errors?.rows?.message || errors?.rows?.root?.message ? <p className="px-3 pt-2 text-xs text-danger">{errors.rows.message ?? errors.rows.root?.message}</p> : null}
      <div className="p-3">
        <Button type="button" variant="outline" size="sm" disabled={fields.length >= MAX_ROWS} onClick={() => append({ ...EMPTY_ROW }, { shouldFocus: true })}>
          <Plus />
          {t.addRow}
        </Button>
      </div>
    </div>
  );
}

/** The two small flags of a row: «في الكارت» (≤ 4 per product) and «فلتر». */
function Flag({ index, row, flag }: { index: number; row: number; flag: "in_card" | "filterable" }) {
  const { control } = useFormContext<ProductValues>();
  const Icon = flag === "in_card" ? LayoutGrid : Filter;
  return (
    <Controller
      control={control}
      name={`specs.${index}.rows.${row}.${flag}`}
      render={({ field }) => (
        <label className="flex items-center gap-1.5 text-xs text-ink-2" title={flag === "in_card" ? ar.specs.group.inCardHint : ar.specs.group.filterHint}>
          <Switch checked={field.value} onCheckedChange={field.onChange} className="scale-90" />
          <Icon className="size-3.5 text-ink-3" aria-hidden />
          {flag === "in_card" ? t.inCardShort : t.filterShort}
        </label>
      )}
    />
  );
}
