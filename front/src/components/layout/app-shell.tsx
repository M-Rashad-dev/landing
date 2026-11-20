"use client";

import { ExternalLink, LogOut, Menu as MenuIcon, Search, UserRound } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";
import { Avatar, Kbd } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, TooltipProvider } from "@/components/ui/overlay";
import { NotificationBell } from "@/features/notifications/bell";
import { logout } from "@/lib/auth/logout";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import type { NavArea } from "@/config/navigation";
import { CommandPalette } from "./command-palette";
import { Sidebar } from "./sidebar";

const COLLAPSE_KEY = "mk_sidebar_collapsed";

const ShellContext = React.createContext<{ openSearch: () => void }>({ openSearch: () => undefined });

/** Shell actions for pages (open the quick search from a button, for example). */
export function useShell() {
  return React.useContext(ShellContext);
}

/** Dashboard frame: sidebar (desktop fixed / mobile sheet), top bar, quick search, toasts. */
export type ShellAccount = { name: string; store: string; /** Public address of the store (null until it has one). */ storeUrl: string | null };

export function AppShell({
  children,
  account,
  area = "dashboard",
  badges,
  userId,
  bellExtra,
  bellExtraCount = 0,
  headerExtra,
  sidePanel,
}: {
  children: React.ReactNode;
  account: ShellAccount;
  area?: NavArea;
  /** Live counts on sidebar items, by page. */
  badges?: Record<string, number>;
  /** The signed-in user (their bell and its live channel). */
  userId: number;
  /** Shown above the bell's list (the admin's "what waits"), with its count for the dot. */
  bellExtra?: React.ReactNode;
  bellExtraCount?: number;
  /** Extra top-bar buttons (the copilot's), before the bell. */
  headerExtra?: React.ReactNode;
  /** A panel docked beside the page at the end side (the copilot drawer); it draws nothing when closed. */
  sidePanel?: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      // Restore the visitor's choice after hydration (localStorage is not available on the server).
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only preference
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // Storage blocked: keep the default.
    }
  }, []);

  function toggle() {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        // Storage blocked: the choice lasts for this visit.
      }
      return !c;
    });
  }

  const shell = React.useMemo(() => ({ openSearch: () => setSearchOpen(true) }), []);

  return (
    <ShellContext.Provider value={shell}>
    <TooltipProvider>
      <div className="flex min-h-dvh">
        <aside className={cn("sticky top-0 hidden h-dvh shrink-0 transition-[width] duration-200 lg:block print:hidden", collapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width)]")}>
          <Sidebar collapsed={collapsed} onToggle={toggle} area={area} badges={badges} />
        </aside>

        <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 lg:hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
            <DialogPrimitive.Content
              dir="rtl"
              className="fixed inset-y-0 start-0 z-50 h-dvh w-[var(--sidebar-width)] max-w-[85vw] overflow-y-auto overscroll-contain shadow-2xl lg:hidden data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-300 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=closed]:duration-200"
            >
              <DialogPrimitive.Title className="sr-only">{ar.nav.openMenu}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">{ar.nav.openMenu}</DialogPrimitive.Description>
              <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} area={area} badges={badges} />
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur sm:px-6 print:hidden">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label={ar.nav.openMenu}>
              <MenuIcon />
            </Button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-ink-3 transition-colors hover:border-border-strong"
            >
              <Search className="size-4" aria-hidden />
              <span className="flex-1 truncate text-start">{area === "admin" ? ar.nav.quickSearchPages : ar.nav.quickSearch}</span>
              <Kbd className="hidden sm:inline-flex">Ctrl K</Kbd>
            </button>
            <div className="ms-auto flex items-center gap-1">
              {account.storeUrl ? (
                <Button variant="ghost" size="sm" className="hidden md:inline-flex" asChild>
                  <a href={account.storeUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink />
                    {ar.nav.visitStore}
                  </a>
                </Button>
              ) : null}
              {headerExtra}
              <NotificationBell area={area} userId={userId} extra={bellExtra} extraCount={bellExtraCount} />
              <Menu>
                <MenuTrigger asChild>
                  <button type="button" className="flex items-center gap-2 rounded-lg p-1 hover:bg-surface-2" aria-label={ar.nav.account}>
                    <Avatar name={account.name} size={30} />
                    <span className="hidden text-start leading-tight md:block">
                      <span className="block text-[13px] font-semibold">{account.name}</span>
                      <span className="block text-[11px] text-ink-3">{account.store}</span>
                    </span>
                  </button>
                </MenuTrigger>
                <MenuContent>
                  <MenuLabel>{account.store}</MenuLabel>
                  {area === "dashboard" ? (
                    <>
                      <MenuItem disabled>
                        <UserRound />
                        {ar.nav.account}
                        <span className="ms-auto text-[11px] text-ink-3">{ar.common.soon}</span>
                      </MenuItem>
                      <MenuSeparator />
                    </>
                  ) : null}
                  <MenuItem destructive onSelect={() => void logout()}>
                    <LogOut />
                    {ar.nav.logout}
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
        {sidePanel}
      </div>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} area={area} />
    </TooltipProvider>
    </ShellContext.Provider>
  );
}
