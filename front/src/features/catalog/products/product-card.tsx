"use client";

import { Check, Copy, ExternalLink, ImageOff, Lock, MoreVertical, Pencil, Star, Trash2, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { MoneyInput } from "@/components/forms/inputs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Switch } from "@/components/ui/choice";
import { toast } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger, Tooltip } from "@/components/ui/overlay";
import { Segmented } from "@/components/ui/tabs";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import type { Category } from "../categories/api";
import { CategoryChecklist } from "../categories/category-checklist";
import { quickUpdate, stockState, type ProductCard as Product, type QuickInput } from "./api";

const t = ar.catalog.products.card;

type CardProps = {
  product: Product;
  categories: Category[];
  storeUrl: string | null;
  selected: boolean;
  onSelect: (on: boolean) => void;
  onChanged: () => Promise<unknown>;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

/**
 * A product as a card. Name, price, categories and quantity edit in place (no page change);
 * quantity kept per option combination is read-only here (edited on the product page).
 */
export function ProductCard({ product, categories, storeUrl, selected, onSelect, onChanged, onToggle, onDuplicate, onDelete }: CardProps) {
  const save = async (body: QuickInput) => {
    try {
      await quickUpdate(product.id, body);
      toast.success(t.saved);
      await onChanged();
      return null;
    } catch (error) {
      if (isApiError(error) && error.isValidation) return Object.values(error.errors)[0]?.[0] ?? errorMessage(error);
      toast.error(errorMessage(error));
      return errorMessage(error);
    }
  };
  const image = product.main_image?.urls.medium ?? product.main_image?.urls.thumb;
  const publicUrl = storeUrl && product.slug && product.in_store ? `${storeUrl}/products/${encodeURIComponent(product.slug)}` : null;

  return (
    <article className={cn("group/card flex flex-col overflow-hidden rounded-xl border bg-surface transition-[border-color,box-shadow]", selected ? "border-primary ring-3 ring-primary/15" : "border-border hover:shadow-md")}>
      <div className="relative aspect-[4/3] bg-surface-2">
        <Link href={`/dashboard/catalog/products/${product.id}`} className="block size-full" tabIndex={-1} aria-hidden>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- media thumbnail
            <img src={image} alt="" loading="lazy" className={cn("size-full object-cover", !product.is_active && "opacity-60 grayscale")} />
          ) : (
            <span className="flex size-full items-center justify-center text-ink-3">
              <ImageOff className="size-6" aria-hidden />
            </span>
          )}
        </Link>
        <span className={cn("absolute start-2.5 top-2.5 rounded-md bg-surface/90 p-1 shadow-sm transition-opacity", !selected && "sm:opacity-0 sm:group-hover/card:opacity-100 sm:focus-within:opacity-100")}>
          <Checkbox checked={selected} onCheckedChange={(v) => onSelect(v === true)} aria-label={t.select(product.name)} />
        </span>
        <div className="absolute end-2.5 top-2.5 flex flex-col items-end gap-1">
          {!product.is_active ? <Badge tone="ink" size="sm">{t.hidden}</Badge> : null}
          {product.locked_by_plan ? <Badge tone="warning" size="sm">{t.lockedByPlan}</Badge> : null}
          {product.is_featured ? (
            <Badge tone="attention" size="sm">
              <Star className="size-3 fill-current" aria-hidden />
              {t.featured}
            </Badge>
          ) : null}
          {!product.in_store ? (
            <Tooltip content={t.landingOnlyHint}>
              <span>
                <Badge tone="info" size="sm">{t.landingOnly}</Badge>
              </span>
            </Tooltip>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <InlineText value={product.name} label={t.editName} onSave={(name) => save({ name })} />
        <InlinePrice product={product} onSave={(price) => save({ price })} />
        <CategoryChips product={product} categories={categories} onSave={(ids, primary) => save({ category_ids: ids, primary_category_id: primary })} />
      </div>

      <div className="flex items-center gap-2 border-t border-border px-3.5 py-2.5">
        <StockControl product={product} onSave={save} />
        <Tooltip content={t.active}>
          <span className="ms-auto inline-flex">
            <Switch checked={product.is_active} onCheckedChange={onToggle} aria-label={t.active} />
          </span>
        </Tooltip>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={ar.common.actions}>
              <MoreVertical />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem asChild>
              <Link href={`/dashboard/catalog/products/${product.id}`}>
                <Pencil />
                {t.edit}
              </Link>
            </MenuItem>
            <MenuItem onSelect={onDuplicate}>
              <Copy />
              {t.duplicate}
            </MenuItem>
            {publicUrl ? (
              <MenuItem asChild>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  {t.view}
                </a>
              </MenuItem>
            ) : null}
            <MenuSeparator />
            <MenuItem destructive onSelect={onDelete}>
              <Trash2 />
              {t.delete}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </article>
  );
}

/* ---------- in-place editors ---------- */

/** Text that turns into a field on click: Enter saves, Esc cancels. */
function InlineText({ value, label, onSave }: { value: string; label: string; onSave: (v: string) => Promise<string | null> }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function commit() {
    const next = draft.trim();
    if (!next) return setError(ar.validation.required);
    if (next === value) return setEditing(false);
    setBusy(true);
    const problem = await onSave(next);
    setBusy(false);
    if (problem) setError(problem);
    else setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setError(null);
          setEditing(true);
        }}
        className="group/edit flex items-start gap-1.5 rounded-md text-start"
        aria-label={`${label}: ${value}`}
      >
        <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{value}</span>
        <Pencil className="mt-1 size-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover/edit:opacity-100 group-focus-visible/edit:opacity-100" aria-hidden />
      </button>
    );
  }

  return (
    <EditRow error={error} busy={busy} onSave={() => void commit()} onCancel={() => setEditing(false)}>
      <Input
        autoFocus
        value={draft}
        maxLength={150}
        aria-label={label}
        aria-invalid={!!error}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    </EditRow>
  );
}

function InlinePrice({ product, onSave }: { product: Product; onSave: (v: string) => Promise<string | null> }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(String(product.price));
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function commit() {
    if (!(Number(draft) > 0)) return setError(ar.validation.required);
    if (Number(draft) === product.price) return setEditing(false);
    setBusy(true);
    const problem = await onSave(draft);
    setBusy(false);
    if (problem) setError(problem);
    else setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(product.price));
          setError(null);
          setEditing(true);
        }}
        className="group/edit flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md text-start"
        aria-label={`${t.editPrice}: ${formatMoney(product.price)}`}
      >
        <span className="tabular text-base font-bold text-ink">{formatMoney(product.price)}</span>
        {product.compare_at_price && product.compare_at_price > product.price ? (
          <>
            <span className="tabular text-xs text-ink-3 line-through">{formatMoney(product.compare_at_price)}</span>
            {product.discount_percent ? <Badge tone="danger" size="sm">-{product.discount_percent}%</Badge> : null}
          </>
        ) : null}
        <Pencil className="size-3.5 self-center text-ink-3 opacity-0 transition-opacity group-hover/edit:opacity-100 group-focus-visible/edit:opacity-100" aria-hidden />
      </button>
    );
  }

  return (
    <EditRow error={error} busy={busy} onSave={() => void commit()} onCancel={() => setEditing(false)}>
      <MoneyInput
        autoFocus
        value={draft}
        onChange={setDraft}
        aria-label={t.editPrice}
        aria-invalid={!!error}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    </EditRow>
  );
}

function EditRow({ children, error, busy, onSave, onCancel }: { children: React.ReactNode; error: string | null; busy: boolean; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">{children}</div>
        <Button size="icon-sm" loading={busy} onClick={onSave} aria-label={t.save}>
          <Check />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onCancel} aria-label={ar.common.cancel}>
          <X />
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CategoryChips({ product, categories, onSave }: { product: Product; categories: Category[]; onSave: (ids: number[], primary: number | null) => Promise<string | null> }) {
  const [open, setOpen] = React.useState(false);
  const [ids, setIds] = React.useState(product.category_ids);
  const [primary, setPrimary] = React.useState(product.primary_category_id);
  const [busy, setBusy] = React.useState(false);
  const ordered = [...product.categories].sort((a, b) => Number(b.id === product.primary_category_id) - Number(a.id === product.primary_category_id));

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setIds(product.category_ids);
          setPrimary(product.primary_category_id);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className="group/edit flex flex-wrap items-center gap-1 rounded-md text-start" aria-label={t.editCategories}>
          {ordered.length === 0 ? (
            <span className="rounded-md border border-dashed border-border-strong px-2 py-0.5 text-xs text-ink-3">{t.addCategory}</span>
          ) : (
            ordered.slice(0, 3).map((c) => (
              <Badge key={c.id} tone={c.id === product.primary_category_id ? "brand-soft" : "neutral"} size="sm">
                {c.id === product.primary_category_id ? <Star className="size-3 fill-current" aria-label={t.primary} /> : null}
                {c.name}
              </Badge>
            ))
          )}
          {ordered.length > 3 ? <Badge tone="neutral" size="sm">+{ordered.length - 3}</Badge> : null}
          <Pencil className="size-3 text-ink-3 opacity-0 transition-opacity group-hover/edit:opacity-100" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <CategoryChecklist
          categories={categories}
          value={ids}
          primary={primary}
          onChange={(next, main) => {
            setIds(next);
            setPrimary(main);
          }}
        />
        <div className="flex gap-2 border-t border-border p-2">
          <Button
            size="sm"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const problem = await onSave(ids, primary);
              setBusy(false);
              if (!problem) setOpen(false);
            }}
          >
            {t.save}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            {ar.common.cancel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function StockLabel({ product }: { product: Product }) {
  const state = stockState(product);
  if (state === "untracked") return <span className="text-ink-2">{t.unlimited}</span>;
  const n = product.stock_total ?? 0;
  return (
    <span className={cn("tabular font-semibold", state === "out" ? "text-danger" : state === "low" ? "text-warning" : "text-ink")}>
      {state === "out" ? t.out : state === "low" ? t.low(n) : t.units(n)}
    </span>
  );
}

function StockControl({ product, onSave }: { product: Product; onSave: (body: QuickInput) => Promise<string | null> }) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"unlimited" | "product">("product");
  const [qty, setQty] = React.useState("0");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (product.stock_mode === "variant") {
    return (
      <Tooltip content={t.fromVariantsHint}>
        <span className="flex items-center gap-1.5 text-[13px]" tabIndex={0}>
          <span className="text-ink-3">{t.stock}:</span>
          <StockLabel product={product} />
          <Lock className="size-3 text-ink-3" aria-label={t.fromVariants} />
        </span>
      </Tooltip>
    );
  }

  async function commit() {
    const n = Number(qty);
    if (mode === "product" && !(Number.isInteger(n) && n >= 0)) return setError(ar.validation.required);
    setBusy(true);
    const problem = await onSave(mode === "unlimited" ? { stock_mode: "unlimited" } : { stock_mode: "product", stock: n });
    setBusy(false);
    if (problem) setError(problem);
    else setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setMode(product.stock_mode === "unlimited" ? "unlimited" : "product");
          setQty(String(product.stock ?? 0));
          setError(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className="group/edit flex items-center gap-1.5 rounded-md text-[13px]" aria-label={t.editStock}>
          <span className="text-ink-3">{t.stock}:</span>
          <StockLabel product={product} />
          <Pencil className="size-3 text-ink-3 opacity-0 transition-opacity group-hover/edit:opacity-100" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-64 flex-col gap-3">
        <Segmented value={mode} onChange={setMode} options={[{ value: "product", label: t.stockMode.product }, { value: "unlimited", label: t.stockMode.unlimited }]} />
        {mode === "product" ? (
          <Input
            autoFocus
            dir="ltr"
            inputMode="numeric"
            className="tabular"
            value={qty}
            aria-label={t.stock}
            aria-invalid={!!error}
            onChange={(e) => /^\d{0,7}$/.test(e.target.value) && setQty(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void commit()}
          />
        ) : null}
        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button size="sm" loading={busy} onClick={() => void commit()}>
            {t.save}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            {ar.common.cancel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
