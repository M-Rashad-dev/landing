import type { LookKey } from "@/themes/shared/sections/looks";

/**
 * Visual language of the store layout per store theme. The markup is shared (themes/store);
 * a store theme picks its classes here plus the look of its home sections (`block`).
 */
export type StoreLook = {
  /** Look of the shared sections and product cards (themes/shared/sections/looks.ts). */
  block: LookKey;
  announcement: string;
  header: string;
  navLink: string;
  dropdown: string;
  search: string;
  iconButton: string;
  badge: string;
  footer: string;
  surface: string;
  input: string;
  chip: (active: boolean) => string;
  muted: string;
};

export const STORE_LOOKS: Record<string, StoreLook> = {
  rewaq: {
    block: "malak",
    announcement: "t-primary px-4 py-2 text-center text-sm font-semibold",
    header: "t-bg sticky top-0 z-40 border-b t-border",
    navLink: "rounded-full px-3 py-2 text-sm font-semibold transition-colors hover:bg-black/5",
    dropdown: "t-bg rounded-2xl border t-border p-2 shadow-[0_12px_40px_rgba(0,0,0,.12)]",
    search: "t-input h-11 w-full rounded-full ps-10 pe-4 text-sm",
    iconButton: "relative flex size-11 items-center justify-center rounded-full transition-colors hover:bg-black/5",
    badge: "t-primary absolute -end-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold leading-5",
    footer: "t-tint mt-16 border-t t-border",
    surface: "t-bg rounded-3xl border t-border p-4 shadow-[0_8px_30px_rgba(0,0,0,.05)] md:p-6",
    input: "t-input h-12 w-full rounded-xl px-3",
    chip: (active) => (active ? "t-primary rounded-full px-4 py-2 text-sm font-semibold" : "t-border rounded-full border px-4 py-2 text-sm hover:bg-black/5"),
    muted: "t-muted",
  },
  diwan: {
    block: "layali",
    announcement: "l-glass px-4 py-2 text-center text-sm font-semibold text-[var(--c-accent)]",
    header: "l-glass sticky top-0 z-40 rounded-none border-x-0 border-t-0",
    navLink: "rounded-full px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/5",
    dropdown: "l-glass rounded-2xl p-2",
    search: "t-input h-11 w-full rounded-full border l-line bg-white/5 ps-10 pe-4 text-sm",
    iconButton: "relative flex size-11 items-center justify-center rounded-full transition-colors hover:bg-white/10",
    badge: "t-primary l-glow-btn absolute -end-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold leading-5",
    footer: "mt-20 border-t l-line",
    surface: "l-glass rounded-[1.75rem] p-4 md:p-6",
    input: "t-input h-12 w-full rounded-xl border l-line bg-white/5 px-3",
    chip: (active) => (active ? "t-primary l-glow-btn rounded-full px-4 py-2 text-sm font-semibold" : "rounded-full border l-line px-4 py-2 text-sm hover:bg-white/5"),
    muted: "t-muted",
  },
};

export function storeLook(themeKey: string | null | undefined): StoreLook {
  return (themeKey && STORE_LOOKS[themeKey]) || STORE_LOOKS.rewaq;
}
