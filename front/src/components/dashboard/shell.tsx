"use client";

import { ExternalLink, LogOut, Menu, Rocket, UserRound } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { DASHBOARD_NAV, isActive, type NavItem } from "./nav-items";
import { useSession, useSiteUrl } from "./session-context";

export function DashboardShell({
  children,
  nav = DASHBOARD_NAV,
  badges = {},
  topbarExtra,
}: {
  children: ReactNode;
  nav?: NavItem[];
  badges?: Partial<Record<NonNullable<NavItem["badgeKey"]>, number>>;
  topbarExtra?: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e bg-card lg:flex">
        <Brand />
        <SidebarNav nav={nav} badges={badges} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="start" className="p-0">
          <SheetTitle className="sr-only">{ar.common.menu}</SheetTitle>
          <Brand />
          <SidebarNav nav={nav} badges={badges} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMobileOpen(true)} extra={topbarExtra} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex h-16 items-center gap-2 border-b px-5 font-extrabold text-primary">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Rocket className="size-4" aria-hidden />
      </span>
      {ar.app.name}
    </Link>
  );
}

function SidebarNav({
  nav,
  badges,
  onNavigate,
}: {
  nav: NavItem[];
  badges: Partial<Record<string, number>>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto p-3" aria-label={ar.common.menu}>
      <ul className="flex flex-col gap-1">
        {nav.map((item) => {
          const active = isActive(pathname, item);
          const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="size-4.5 shrink-0" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {badge ? (
                  <span className="min-w-5 rounded-full bg-destructive px-1.5 text-center text-xs font-bold leading-5 text-destructive-foreground">{badge > 99 ? "99+" : badge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Topbar({ onOpenMenu, extra }: { onOpenMenu: () => void; extra?: ReactNode }) {
  const session = useSession();
  const toSite = useSiteUrl();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const site = toSite(session.primary_host);

  async function logout() {
    setLeaving(true);
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label={ar.nav.openMenu}>
        <Menu />
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{session.tenant?.name ?? ar.app.name}</p>
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
          <Button variant="ghost" size="icon" aria-label={ar.nav.account}>
            <UserRound />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>
            <span className="block font-semibold text-foreground">{session.user.name}</span>
            <span className="block" dir="ltr">
              {session.user.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {session.tenant ? (
            <DropdownMenuItem onSelect={() => router.push("/dashboard/settings")}>
              <UserRound />
              {ar.nav.settings}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem destructive disabled={leaving} onSelect={logout}>
            <LogOut />
            {ar.auth.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
