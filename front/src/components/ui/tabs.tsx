"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Two looks, one API:
 * - "line" (default): page sections under the header (orders: all / new / confirmed...).
 * - "pills": filters or sub-views inside a panel, and jump bars.
 * Both scroll sideways on small screens with no visible bar.
 */
type Variant = "line" | "pills";
const VariantContext = React.createContext<Variant>("line");

export const Tabs = (props: React.ComponentProps<typeof TabsPrimitive.Root>) => <TabsPrimitive.Root dir="rtl" {...props} />;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, variant = "line", ...props }: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: Variant }) {
  return (
    <VariantContext.Provider value={variant}>
      <TabsPrimitive.List
        className={cn("no-scrollbar flex overflow-x-auto", variant === "line" ? "gap-6 border-b border-border" : "gap-2", className)}
        {...props}
      />
    </VariantContext.Provider>
  );
}

export function TabsTrigger({ className, count, children, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger> & { count?: number }) {
  const variant = React.useContext(VariantContext);
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "group flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold transition-colors focus-visible:outline-offset-0",
        variant === "line"
          ? "relative -mb-px border-b-2 border-transparent pb-3 pt-1 text-ink-3 hover:text-ink data-[state=active]:border-primary data-[state=active]:text-ink"
          : "h-9 rounded-full border border-border bg-surface px-4 text-ink-2 hover:border-border-strong hover:text-ink data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-ink",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined ? <TabCount value={count} variant={variant} /> : null}
    </TabsPrimitive.Trigger>
  );
}

function TabCount({ value, variant }: { value: number; variant: Variant }) {
  return (
    <span
      className={cn(
        "tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
        variant === "line"
          ? "bg-surface-2 text-ink-3 group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-ink"
          : "bg-surface-2 text-ink-3 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-primary-ink",
      )}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

/** Segmented control: small switches of view or period (7 / 30 / 90 days). */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; className?: string }) {
  return (
    <div role="radiogroup" className={cn("no-scrollbar inline-flex max-w-full overflow-x-auto rounded-lg bg-surface-2 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn("h-8 shrink-0 rounded-md px-3 text-[13px] font-semibold transition-colors", o.value === value ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Links to the parts of a long page; highlights the part on screen (scroll spy). */
export function JumpBar({ items, className, label }: { items: Array<{ id: string; label: string }>; className?: string; label: string }) {
  const [active, setActive] = React.useState(items[0]?.id ?? "");
  const [edges, setEdges] = React.useState({ start: false, end: false });
  const listRef = React.useRef<HTMLUListElement>(null);

  // Fades show only on a side that still has chips to scroll to (RTL: scrollLeft goes negative).
  const measure = React.useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft);
    setEdges({ start: pos > 4, end: max - pos > 4 });
  }, []);

  React.useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  React.useEffect(() => {
    const sections = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [items]);

  // Keep the active chip in view when the page scrolls: move the chip row sideways only.
  // (scrollIntoView would also scroll the page back up to the bar when it is off screen.)
  React.useEffect(() => {
    const list = listRef.current;
    const chip = list?.querySelector<HTMLElement>(`[data-id="${CSS.escape(active)}"]`);
    if (!list || !chip) return;
    const listBox = list.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    if (chipBox.left < listBox.left) list.scrollBy?.({ left: chipBox.left - listBox.left - 8, behavior: "smooth" });
    else if (chipBox.right > listBox.right) list.scrollBy?.({ left: chipBox.right - listBox.right + 8, behavior: "smooth" });
  }, [active]);

  return (
    <nav aria-label={label} className={cn("relative", className)}>
      <ul ref={listRef} onScroll={measure} className="no-scrollbar flex gap-2 overflow-x-auto">
        {items.map((item) => (
          <li key={item.id} data-id={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "true" : undefined}
              className={cn(
                "inline-flex h-9 items-center whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold transition-colors",
                active === item.id ? "border-primary bg-primary text-primary-ink" : "border-border bg-surface text-ink-2 hover:border-border-strong hover:text-ink",
              )}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
      {/* Soft fade at the ends hints that there is more to scroll. */}
      {edges.start ? <span className="pointer-events-none absolute inset-y-0 start-0 w-10 bg-gradient-to-l from-bg to-transparent" aria-hidden /> : null}
      {edges.end ? <span className="pointer-events-none absolute inset-y-0 end-0 w-10 bg-gradient-to-r from-bg to-transparent" aria-hidden /> : null}
    </nav>
  );
}
