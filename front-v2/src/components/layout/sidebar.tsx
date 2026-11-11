"use client";

import { ChevronsLeft, ChevronsRight, Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { CountBadge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/overlay";
import { DASHBOARD_FOOTER_NAV, DASHBOARD_NAV, isActive, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

/**
 * Light sidebar: groups, counts, locked ("soon") pages, collapsible to icons on desktop.
 * The active page gets the orange marker on its start edge.
 */
export function Sidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle?: () => void; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label={ar.nav.openMenu} className="flex h-full flex-col border-e border-border bg-surface">
      <div className={cn("flex h-16 shrink-0 items-center border-b border-border", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        <Link href="/dashboard/components" onClick={onNavigate}>
          <Logo collapsed={collapsed} />
        </Link>
        {onToggle && !collapsed ? (
          <button type="button" onClick={onToggle} className="hidden rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink lg:block" aria-label={ar.nav.collapse}>
            <ChevronsRight className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {DASHBOARD_NAV.map((group, i) => (
          <div key={group.label ?? i} className={i > 0 ? "mt-4" : undefined}>
            {group.label && !collapsed ? <p className="mb-1 px-3 text-[11px] font-semibold text-ink-3">{group.label}</p> : null}
            {collapsed && i > 0 ? <hr className="mx-3 mb-2 border-border" /> : null}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={isActive(pathname, item)} collapsed={collapsed} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-2 py-3">
        <ul className="flex flex-col gap-0.5">
          {DASHBOARD_FOOTER_NAV.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(pathname, item)} collapsed={collapsed} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        {onToggle && collapsed ? (
          <button type="button" onClick={onToggle} className="mx-auto mt-2 hidden rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink lg:block" aria-label={ar.nav.expand}>
            <ChevronsLeft className="size-4" />
          </button>
        ) : null}
      </div>
    </nav>
  );
}

function NavLink({ item, active, collapsed, onNavigate }: { item: NavItem; active: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const locked = item.status === "soon";
  const base = cn("relative flex h-9 items-center gap-3 rounded-lg text-sm transition-colors", collapsed ? "justify-center px-0" : "px-3");

  const inner = (
    <>
      {active ? <span className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-brand" aria-hidden /> : null}
      <Icon className={cn("size-[18px] shrink-0", active ? "text-brand-strong" : "text-ink-3")} aria-hidden />
      {collapsed ? null : (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {locked ? <Lock className="size-3.5 text-ink-3" aria-label={ar.common.soon} /> : item.badge ? <CountBadge value={item.badge} tone="attention" /> : null}
        </>
      )}
    </>
  );

  const node = locked ? (
    <span aria-disabled className={cn(base, "cursor-not-allowed text-ink-3/80")}>
      {inner}
    </span>
  ) : (
    <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn(base, active ? "bg-brand-soft font-semibold text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}>
      {inner}
    </Link>
  );

  if (collapsed) return <Tooltip content={locked ? `${item.label} · ${ar.nav.lockedHint}` : item.label} side="left">{node}</Tooltip>;
  if (locked) return <Tooltip content={ar.nav.lockedHint} side="left">{node}</Tooltip>;
  return node;
}
