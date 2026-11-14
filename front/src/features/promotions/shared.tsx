"use client";

import { MoreHorizontal, Pencil, Search, Trash2, type LucideIcon } from "lucide-react";
import * as React from "react";
import { Pagination } from "@/components/data/data-table";
import { DatePicker } from "@/components/forms/date-pickers";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioCards, Switch } from "@/components/ui/choice";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { InputGroup } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { MultiSelect, Select } from "@/components/ui/select";
import { pathOf, useCategories } from "@/features/catalog/categories/api";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { ar } from "@/messages/ar";
import { STATUS_FILTERS, useProductChoices, type Named, type Paginated, type PromoStatus, type StatusFilter, type Target } from "./api";

const t = ar.promotions;

const TONES: Record<PromoStatus, Tone> = { active: "success", scheduled: "info", expired: "neutral", inactive: "warning" };

export function StatusBadge({ status, locked }: { status: PromoStatus; locked?: boolean }) {
  if (locked) return <Badge tone="danger">{t.lockedByPlan}</Badge>;
  return (
    <Badge tone={TONES[status]} dot>
      {t.status[status]}
    </Badge>
  );
}

/* ---------- who it covers ---------- */

export type TargetValue = { applies_to: Target; product_ids: number[]; category_ids: number[] };

export function TargetFields({ value, onChange, errors, idPrefix }: { value: TargetValue; onChange: (v: TargetValue) => void; errors?: { product_ids?: string; category_ids?: string }; idPrefix: string }) {
  const products = useProductChoices();
  const categories = useCategories();
  const allCategories = categories.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <RadioCards
        className="sm:grid-cols-3"
        value={value.applies_to}
        onValueChange={(v) => onChange({ ...value, applies_to: v as Target })}
        options={[
          { value: "all", title: t.target.all, description: t.target.allHint },
          { value: "products", title: t.target.products, description: t.target.productsHint },
          { value: "categories", title: t.target.categories, description: t.target.categoriesHint },
        ]}
      />
      {value.applies_to === "products" ? (
        <Field label={t.target.pickProducts} htmlFor={`${idPrefix}-products`} error={errors?.product_ids} hint={products.data?.length === 0 ? t.target.noProducts : undefined} required>
          <MultiSelect
            id={`${idPrefix}-products`}
            value={value.product_ids.map(String)}
            onChange={(ids) => onChange({ ...value, product_ids: ids.map(Number) })}
            options={(products.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
            placeholder={t.target.pickProducts}
            countLabel={t.target.productsCount}
            invalid={!!errors?.product_ids}
          />
        </Field>
      ) : null}
      {value.applies_to === "categories" ? (
        <Field label={t.target.pickCategories} htmlFor={`${idPrefix}-categories`} error={errors?.category_ids} required>
          <MultiSelect
            id={`${idPrefix}-categories`}
            value={value.category_ids.map(String)}
            onChange={(ids) => onChange({ ...value, category_ids: ids.map(Number) })}
            options={allCategories.map((c) => ({ value: String(c.id), label: c.name, hint: pathOf(allCategories, c) || undefined }))}
            placeholder={t.target.pickCategories}
            countLabel={t.target.categoriesCount}
            invalid={!!errors?.category_ids}
          />
        </Field>
      ) : null}
    </div>
  );
}

/** "على كل المنتجات" / "على تيشيرت وبنطلون" / "على تصنيف أحذية". */
export function targetText(p: { applies_to: Target; products?: Named[]; categories?: Named[] }): string {
  if (p.applies_to === "products") return t.target.onProducts((p.products ?? []).map((x) => x.name));
  if (p.applies_to === "categories") return t.target.onCategories((p.categories ?? []).map((x) => x.name));
  return t.target.onAll;
}

/* ---------- when ---------- */

export function PeriodFields({ starts, ends, onChange, errors, idPrefix }: { starts: string; ends: string; onChange: (v: { starts: string; ends: string }) => void; errors?: { starts_at?: string; ends_at?: string }; idPrefix: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t.period.starts} htmlFor={`${idPrefix}-starts`} error={errors?.starts_at} hint={starts ? undefined : t.period.startsNow}>
        <DatePicker id={`${idPrefix}-starts`} withTime value={starts} onChange={(v) => onChange({ starts: v, ends })} invalid={!!errors?.starts_at} className="sm:w-full" />
      </Field>
      <Field label={t.period.ends} htmlFor={`${idPrefix}-ends`} error={errors?.ends_at} hint={ends ? undefined : t.period.noEnd}>
        <DatePicker id={`${idPrefix}-ends`} withTime value={ends} onChange={(v) => onChange({ starts, ends: v })} invalid={!!errors?.ends_at} className="sm:w-full" />
      </Field>
    </div>
  );
}

export function periodText(p: { starts_at: string | null; ends_at: string | null }): string | null {
  const parts = [p.starts_at ? t.period.from(formatDateTime(p.starts_at)) : null, p.ends_at ? t.period.until(formatDateTime(p.ends_at)) : null].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

/* ---------- list ---------- */

export function ListToolbar({ search, onSearch, status, onStatus, placeholder }: { search: string; onSearch: (v: string) => void; status: StatusFilter; onStatus: (v: StatusFilter) => void; placeholder: string }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
      <InputGroup start={<Search />} value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="sm:w-72" />
      <Select aria-label={t.statusLabel} value={status} onValueChange={(v) => onStatus((v || "all") as StatusFilter)} options={STATUS_FILTERS.map((s) => ({ value: s, label: t.status[s] }))} searchable={false} className="sm:w-48" />
    </div>
  );
}

export type RowAction = { label: string; icon: LucideIcon; onSelect: () => void };

/** One promotion in a list: what it is, what the customer gets, when, its switch and menu. */
export function PromoRow({
  icon: Icon,
  title,
  titleClassName,
  summary,
  meta,
  status,
  locked,
  active,
  onToggle,
  onEdit,
  onDelete,
  extra = [],
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  titleClassName?: string;
  summary: string;
  meta: Array<string | null>;
  status: PromoStatus;
  locked?: boolean;
  active: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  extra?: RowAction[];
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3.5 sm:items-center">
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong sm:mt-0">
        <Icon className="size-5" aria-hidden />
      </span>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-start">
        <span className="flex flex-wrap items-center gap-2">
          <span className={titleClassName ?? "font-semibold"}>{title}</span>
          <StatusBadge status={status} locked={locked} />
        </span>
        {summary !== title ? <span className="mt-0.5 block text-sm text-ink-2">{summary}</span> : null}
        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-3">
          {meta.filter(Boolean).map((m) => (
            <span key={m}>{m}</span>
          ))}
        </span>
      </button>
      <Switch checked={active} onCheckedChange={onToggle} aria-label={t.active} />
      <Menu>
        <MenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={ar.common.actions}>
            <MoreHorizontal />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onEdit}>
            <Pencil />
            {t.edit}
          </MenuItem>
          {extra.map((a) => (
            <MenuItem key={a.label} onSelect={a.onSelect}>
              <a.icon />
              {a.label}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem destructive onSelect={onDelete}>
            <Trash2 />
            {t.delete}
          </MenuItem>
        </MenuContent>
      </Menu>
    </li>
  );
}

/** Skeleton / error / empty (first time or filtered) / rows + pages. */
export function PromoList<T>({
  query,
  filtered,
  empty,
  onClearFilters,
  onPage,
  children,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; data?: Paginated<T>; refetch: () => unknown };
  filtered: boolean;
  empty: { icon: LucideIcon; title: string; text: string; action: React.ReactNode };
  onClearFilters: () => void;
  onPage: (page: number) => void;
  children: (items: T[]) => React.ReactNode;
}) {
  if (query.isPending) {
    return (
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-4">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3.5 w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  const items = query.data?.data ?? [];
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface">
        {filtered ? (
          <EmptyState icon={Search} title={t.noResults} description={t.noResultsText} action={<Button variant="outline" onClick={onClearFilters}>{t.clearFilters}</Button>} />
        ) : (
          <EmptyState icon={empty.icon} title={empty.title} description={empty.text} action={empty.action} />
        )}
      </div>
    );
  }
  return (
    <>
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">{children(items)}</ul>
      {query.data ? <Pagination page={query.data.meta.current_page} lastPage={query.data.meta.last_page} total={query.data.meta.total} onPageChange={onPage} /> : null}
    </>
  );
}

/** Debounced search kept in the URL. */
export function useDebouncedSearch(urlValue: string, commit: (v: string | null) => void) {
  const [search, setSearch] = React.useState(urlValue);
  React.useEffect(() => {
    const id = window.setTimeout(() => search.trim() !== urlValue && commit(search.trim() || null), 300);
    return () => window.clearTimeout(id);
  }, [search, urlValue, commit]);
  return [search, setSearch] as const;
}
