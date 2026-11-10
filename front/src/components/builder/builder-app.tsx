"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Copy, ExternalLink, Laptop, Loader2, Monitor, Redo2, Save, Smartphone, Tablet, Undo2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "zustand";
import { useSession, useSiteUrl } from "@/components/dashboard/session-context";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useIdentities } from "@/lib/identity/api";
import { pageKeys, publishPage, unpublishPage, updatePage, type Blocker, type PageDetail } from "@/lib/pages/api";
import { useProducts } from "@/lib/products/api";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { BuilderProvider } from "./context";
import { PreviewFrame, type Device } from "./preview-frame";
import { SectionsPanel } from "./sections-panel";
import { SettingsPanel } from "./settings-panel";
import { createBuilderStore } from "./store";
import { useAutosave } from "./use-autosave";

const t = ar.builder;
type MobileTab = "sections" | "preview" | "settings";

export function BuilderApp({ page, themes }: { page: PageDetail; themes: Array<{ key: string; name: string; owned?: boolean }> }) {
  const [store] = useState(() => {
    const created = createBuilderStore();
    created.getState().init({
      page: { id: page.id, title: page.title, slug: page.slug, status: page.status, identity_id: page.identity_id, product_id: page.product_id },
      content: page.draft_content,
      themeKey: page.theme_key,
      version: page.version,
    });
    return created;
  });

  return (
    <BuilderProvider store={store}>
      <BuilderScreen store={store} page={page} themes={themes} />
    </BuilderProvider>
  );
}

function BuilderScreen({ store, page, themes }: { store: ReturnType<typeof createBuilderStore>; page: PageDetail; themes: Array<{ key: string; name: string; owned?: boolean }> }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const toSite = useSiteUrl();
  const { save, conflict, reloadFromServer, overwrite } = useAutosave(store, page.id);
  const saveState = useStore(store, (s) => s.saveState);
  const canUndo = useStore(store, (s) => s.history.length > 0);
  const canRedo = useStore(store, (s) => s.future.length > 0);
  const meta = useStore(store, (s) => s.page);
  const [device, setDevice] = useState<Device>("desktop");
  const [tab, setTab] = useState<MobileTab>("preview");
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingTheme, setPendingTheme] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<Blocker[] | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [metaSaving, setMetaSaving] = useState(false);
  const isWide = useMediaQuery("(min-width: 1024px)", true);
  const identities = useIdentities();
  const products = useProducts({ per_page: 100 });

  const liveUrl = meta ? toSite(session.primary_host, page.is_home ? "/" : `/${meta.slug}`) : "";

  const select = useCallback(
    (id: string) => {
      store.getState().select(id);
      setTab("settings");
    },
    [store],
  );

  // Keyboard: Ctrl/Cmd+S save, Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo (not while typing).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void save();
        return;
      }
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing) return;
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        store.getState().undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        store.getState().redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, store]);

  async function changeMeta(patch: { identity_id?: number; product_id?: number | null }) {
    if (!meta) return;
    setMetaSaving(true);
    try {
      const updated = await updatePage(page.id, {
        title: meta.title,
        slug: meta.slug,
        identity_id: patch.identity_id ?? meta.identity_id,
        product_id: patch.product_id === undefined ? meta.product_id : patch.product_id,
      });
      store.getState().setPageMeta({ identity_id: updated.identity_id, product_id: updated.product_id });
      setReloadKey((k) => k + 1);
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setMetaSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      if (!(await save())) return;
      await publishPage(page.id);
      store.getState().setPageMeta({ status: "published" });
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      setPublishedUrl(liveUrl);
    } catch (error) {
      if (isApiError(error) && error.code === "publish_blocked") setBlockers((error.body.blockers as Blocker[] | undefined) ?? []);
      else toast.error(errorMessage(error));
    } finally {
      setPublishing(false);
    }
  }

  async function unpublish() {
    try {
      await unpublishPage(page.id);
      store.getState().setPageMeta({ status: "draft" });
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success(ar.pages.unpublished);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  function fixBlocker(code: string) {
    setBlockers(null);
    if (code === "order_form_missing" || code === "no_visible_sections" || code === "order_form_multiple") {
      store.getState().select(null);
      setTab("sections");
    } else if (code === "no_product" || code === "product_inactive" || code === "theme_inactive" || code === "identity_missing") {
      store.getState().select(null);
      setTab("settings");
    }
  }

  const saveIcon = saveState === "saving" ? <Loader2 className="size-4 animate-spin" /> : saveState === "error" ? <AlertCircle className="size-4 text-destructive" /> : saveState === "saved" ? <Check className="size-4 text-success" /> : <span className="size-2 rounded-full bg-warning" />;

  const devices: Array<{ key: Device; icon: typeof Smartphone; label: string }> = [
    { key: "mobile", icon: Smartphone, label: t.device.mobile },
    { key: "tablet", icon: Tablet, label: t.device.tablet },
    { key: "desktop", icon: Monitor, label: t.device.desktop },
  ];

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-2 sm:px-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/pages" aria-label={t.back}>
            <ArrowRight />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{meta?.title}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            {saveIcon}
            {t.saveState[saveState]}
          </p>
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          <Button variant="ghost" size="icon-sm" disabled={!canUndo} onClick={() => store.getState().undo()} aria-label={t.undo} title={`${t.undo} (Ctrl+Z)`}>
            <Undo2 />
          </Button>
          <Button variant="ghost" size="icon-sm" disabled={!canRedo} onClick={() => store.getState().redo()} aria-label={t.redo} title={`${t.redo} (Ctrl+Shift+Z)`}>
            <Redo2 />
          </Button>
        </div>
        <div className="relative hidden items-center rounded-lg border bg-muted/50 p-0.5 md:flex" role="radiogroup" aria-label="device">
          {/* Sliding highlight under the active device. */}
          <span
            className="absolute inset-y-0.5 w-8 rounded-md bg-card shadow-sm transition-[inset-inline-start] duration-300 ease-[var(--ease-out)]"
            style={{ insetInlineStart: `calc(0.125rem + ${devices.findIndex((d) => d.key === device)} * 2rem)` }}
            aria-hidden
          />
          {devices.map((d) => (
            <button key={d.key} type="button" role="radio" aria-checked={device === d.key} aria-label={d.label} title={d.label} onClick={() => setDevice(d.key)} className={cn("relative flex size-8 items-center justify-center rounded-md transition-colors", device === d.key ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              <d.icon className="size-4" />
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => void save()} disabled={saveState === "saving"} title="Ctrl+S">
          <Save />
          <span className="hidden sm:inline">{t.save}</span>
        </Button>
        <Button variant="ghost" size="icon-sm" asChild className="hidden sm:inline-flex">
          <a href={`/preview/${page.id}`} target="_blank" rel="noopener noreferrer" aria-label={t.openPreview} title={t.openPreview}>
            <Laptop />
          </a>
        </Button>
        {meta?.status === "published" ? (
          <Button variant="ghost" size="sm" className="hidden lg:inline-flex" onClick={unpublish}>
            {t.unpublish}
          </Button>
        ) : null}
        <Button size="sm" onClick={publish} loading={publishing}>
          {t.publish}
        </Button>
      </header>

      <div className="flex border-b bg-card lg:hidden" role="tablist">
        {(["sections", "preview", "settings"] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn("flex-1 py-2.5 text-sm font-semibold", tab === key ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
            {t[key]}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className={cn("w-full shrink-0 border-e bg-card lg:block lg:w-72", tab === "sections" ? "block" : "hidden")}>
          <SectionsPanel onSelect={select} />
        </aside>
        <main className={cn("min-w-0 flex-1 lg:block", tab === "preview" ? "block" : "hidden")}>
          <PreviewFrame pageId={page.id} device={isWide ? device : "mobile"} reloadKey={reloadKey} onSelect={select} />
        </main>
        <aside className={cn("w-full shrink-0 overflow-y-auto border-s bg-card lg:block lg:w-96", tab === "settings" ? "block" : "hidden")}>
          <SettingsPanel
            themes={themes}
            identities={identities.data?.data ?? []}
            products={products.data?.data ?? []}
            onThemeRequest={(key) => key !== store.getState().themeKey && setPendingTheme(key)}
            onMetaChange={changeMeta}
            metaSaving={metaSaving}
          />
        </aside>
      </div>

      <ConfirmDialog
        open={pendingTheme !== null}
        onOpenChange={(open) => !open && setPendingTheme(null)}
        title={t.themeSwitchTitle}
        description={t.themeSwitchText}
        confirmLabel={t.themeSwitch}
        onConfirm={() => {
          if (pendingTheme) store.getState().setTheme(pendingTheme);
          setPendingTheme(null);
        }}
      />

      <Dialog open={conflict !== null}>
        <DialogContent size="sm" hideClose>
          <DialogHeader>
            <DialogTitle>{t.conflictTitle}</DialogTitle>
            <DialogDescription>{t.conflictText}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button variant="outline" onClick={reloadFromServer}>
              {t.conflictReload}
            </Button>
            <Button onClick={overwrite}>{t.conflictOverwrite}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={blockers !== null} onOpenChange={(open) => !open && setBlockers(null)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{t.blockersTitle}</DialogTitle>
            <DialogDescription>{t.blockersText}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <ul className="flex flex-col gap-2">
              {blockers?.map((blocker) => (
                <li key={blocker.code} className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                  <span>{blocker.message}</span>
                  <Button size="sm" variant="outline" onClick={() => fixBlocker(blocker.code)}>
                    {t.fix}
                  </Button>
                </li>
              ))}
            </ul>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={publishedUrl !== null} onOpenChange={(open) => !open && setPublishedUrl(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t.publishedTitle}</DialogTitle>
            <DialogDescription>{t.publishedText}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm" dir="ltr">
                {publishedUrl}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={ar.pages.copyLink}
                onClick={async () => {
                  await navigator.clipboard.writeText(publishedUrl ?? "").catch(() => undefined);
                  toast.success(ar.pages.linkCopied);
                }}
              >
                <Copy />
              </Button>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => router.push("/dashboard/pages")}>
              {t.back}
            </Button>
            <Button asChild>
              <a href={publishedUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                {ar.pages.viewLive}
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
