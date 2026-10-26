"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import { MediaThumb } from "@/components/shared/media/media-thumb";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounced } from "@/lib/hooks/use-debounced";
import { formatPrice } from "@/lib/price";
import { useProducts } from "@/lib/products/api";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

type Option = { id: number; name: string };

/** Searchable multi-select of the tenant's products (ids). */
export function ProductMultiSelect({
  id,
  value,
  onChange,
  known = [],
  placeholder = ar.promotions.chooseProducts,
  invalid,
}: {
  id?: string;
  value: number[];
  onChange: (ids: number[]) => void;
  /** Names for already-selected ids (from the edited record). */
  known?: Option[];
  placeholder?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search, 250);
  const { data, isPending } = useProducts({ q: debounced, per_page: 50 });
  const [names, setNames] = useState<Map<number, string>>(() => new Map(known.map((item) => [item.id, item.name])));

  function toggle(product: Product) {
    setNames((current) => new Map(current).set(product.id, product.name));
    onChange(value.includes(product.id) ? value.filter((v) => v !== product.id) : [...value, product.id]);
  }

  return (
    <div className="flex flex-col gap-2">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            className={cn("flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-start text-sm", invalid && "border-destructive")}
          >
            <span className={value.length ? "" : "text-muted-foreground"}>{value.length ? ar.promotions.selectedCount(value.length) : placeholder}</span>
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content dir="rtl" align="start" sideOffset={6} className="z-50 w-[min(24rem,calc(100vw-2rem))] rounded-xl border bg-card p-2 shadow-lg">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={ar.promotions.searchProducts} className="ps-9" aria-label={ar.promotions.searchProducts} />
            </div>
            <ul className="max-h-72 overflow-y-auto" role="listbox" aria-multiselectable>
              {isPending ? (
                <li className="flex flex-col gap-2 p-2">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </li>
              ) : data?.data.length ? (
                data.data.map((product) => {
                  const selected = value.includes(product.id);
                  return (
                    <li key={product.id} role="option" aria-selected={selected}>
                      <button type="button" onClick={() => toggle(product)} className="flex w-full items-center gap-3 rounded-lg p-2 text-start hover:bg-accent">
                        <span className={cn("flex size-5 items-center justify-center rounded border", selected ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                          {selected ? <Check className="size-3.5" /> : null}
                        </span>
                        <MediaThumb media={product.main_image} className="size-9" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{product.name}</span>
                          <span className="block text-xs text-muted-foreground">{formatPrice(product.price)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="p-3 text-center text-sm text-muted-foreground">{ar.common.noResults}</li>
              )}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((productId) => (
            <li key={productId} className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              {names.get(productId) ?? `#${productId}`}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== productId))} aria-label={ar.common.delete} className="rounded-full p-0.5 hover:bg-black/10">
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
