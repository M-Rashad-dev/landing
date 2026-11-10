"use client";

import { ExternalLink, Lock, LogOut, Menu, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { isClosed, usePlan } from "@/components/billing/plan";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { BrandMark } from "./brand-mark";
import { DASHBOARD_FOOTER_NAV, DASHBOARD_NAV, isActive, type NavGroup, type NavItem } from "./nav-items";
import { useSession, useSiteUrl } from "./session-context";

type Badges = Partial<Record<NonNullable<NavItem["badgeKey"]>, number>>;

export function DashboardShell({
  children,
  nav = DASHBOARD_NAV,
  footerNav = nav === DASHBOARD_NAV ? DASHBOARD_FOOTER_NAV : [],
  badges = {},
  topbarExtra,
  banner,
}: {
  children: ReactNode;
  nav?: NavGroup[];
  footerNav?: NavItem[];
  badges?: Badges;
  topbarExtra?: ReactNode;
  banner?: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const home = nav[0]?.items[0]?.href ?? "/dashboard";
  const sidebar = (onNavigate?: () => void) => <Sidebar nav={nav} footerNav={footerNav} badges={badges} home={home} onNavigate={onNavigate} />;

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[17rem] shrink-0 lg:block">{sidebar()}</aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="start" className="border-0 bg-sidebar p-0 [&>button]:text-sidebar-muted [&>button:hover]:bg-sidebar-hover [&>button:hover]:text-sidebar-active">
          <SheetTitle className="sr-only">{ar.common.menu}</SheetTitle>
          {sidebar(() => setMobileOpen(false))}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMobileOpen(true)} extra={topbarExtra} />
        {banner}
        {/* Keyed by path: each page fades in instead of swapping abruptly. */}
        <main key={pathname} className="page-enter mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({ nav, footerNav, badges, home, onNavigate }: { nav: NavGroup[]; footerNav: NavItem[]; badges: Badges; home: string; onNavigate?: () => void }) {
  const session = useSession();
  const toSite = useSiteUrl();
  const site = toSite(session.primary_host);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link href={home} onClick={onNavigate} className="flex h-16 shrink-0 items-center gap-3 px-5">
        <BrandMark />
        <span className="flex flex-col leading-tight">
          <span className="font-display text-[15px] font-semibold text-sidebar-active">{ar.app.name}</span>
          <span className="text-[11px] text-sidebar-muted">{ar.nav.tagline}</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label={ar.common.menu}>
        {nav.map((group, index) => (
          <div key={group.label ?? index} className={cn(index > 0 && "mt-5")}>
            {group.label ? <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-sidebar-muted">{group.label}</p> : null}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} badge={item.badgeKey ? badges[item.badgeKey] : undefined} onNavigate={onNavigate} />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        {footerNav.length ? (
          <ul className="mb-2 flex flex-col gap-0.5">
            {footerNav.map((item) => (
              <NavLink key={item.href} item={item} onNavigate={onNavigate} />
            ))}
          </ul>
        ) : null}
        {session.tenant ? (
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-hover px-3 py-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gold font-display text-sm font-bold text-gold-foreground">{session.tenant.name.trim().charAt(0) || "؟"}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-sidebar-active">{session.tenant.name}</span>
              {site ? (
                <a href={site} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-sidebar-muted transition-colors hover:text-gold">
                  {ar.nav.visitSite}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NavLink({ item, badge, onNavigate }: { item: NavItem; badge?: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, item);
  const plan = usePlan();
  // Locked features stay in the menu (the merchant learns they exist) with a small lock.
  const locked = item.gate ? isClosed(plan, item.gate) && plan?.state !== "expired" : false;

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
          active ? "bg-sidebar-hover font-semibold text-sidebar-active" : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-active",
        )}
      >
        <span className={cn("absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-gold transition-opacity duration-200", active ? "opacity-100" : "opacity-0")} aria-hidden />
        <item.icon className={cn("size-[18px] shrink-0 transition-colors", active ? "text-gold" : "text-sidebar-muted group-hover:text-sidebar-foreground")} aria-hidden />
        <span className="flex-1">{item.label}</span>
        {locked ? <Lock className="size-3.5 shrink-0 text-sidebar-muted" aria-label={ar.billing.upgrade} /> : null}
        {badge ? <span className="min-w-5 rounded-full bg-gold px-1.5 text-center text-[11px] font-bold leading-5 text-gold-foreground">{badge > 99 ? "99+" : badge}</span> : null}
      </Link>
    </li>
  );
}

function Topbar({ onOpenMenu, extra }: { onOpenMenu: () => void; extra?: ReactNode }) {
  const session = useSession();
  const toSite = useSiteUrl();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const site = toSite(session.primary_host);
  const initial = session.user.name.trim().charAt(0) || "؟";

  async function logout() {
    setLeaving(true);
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label={ar.nav.openMenu}>
        <Menu />
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-semibold lg:hidden">{session.tenant?.name ?? (session.user.role === "super_admin" ? ar.admin.title : ar.app.name)}</p>
        {session.user.role === "super_admin" ? <p className="hidden font-display font-semibold lg:block">{ar.admin.title}</p> : null}
      </div>
      {extra}
      {site ? (
        <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
          <a href={site} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
            {ar.nav.visitSite}
          </a>
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={ar.nav.account} className="flex size-9 items-center justify-center rounded-full bg-secondary font-display text-sm font-semibold text-secondary-foreground ring-offset-2 transition-shadow hover:ring-2 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            {initial}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-56">
          <DropdownMenuLabel>
            <span className="block font-semibold text-foreground">{session.user.name}</span>
            <span className="block" dir="ltr">
              {session.user.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {session.tenant ? (
            <DropdownMenuItem onSelect={() => router.push("/dashboard/settings")}>
              <Settings />
              {ar.nav.settings}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>
              <UserRound />
              {ar.admin.title}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem destructive disabled={leaving} onSelect={logout}>
            <LogOut />
            {ar.auth.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
