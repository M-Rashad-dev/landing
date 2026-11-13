"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  LayoutList,
  LayoutPanelTop,
  Laptop,
  Loader2,
  MoreHorizontal,
  Palette,
  PanelBottom,
  Plus,
  Redo2,
  Rocket,
  Settings2,
  Smartphone,
  Tablet,
  Trash2,
  TriangleAlert,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { SortableList } from "@/components/data/sortable-list";
import { Button } from "@/components/ui/button";
import { Alert, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { ConfirmDialog, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tooltip } from "@/components/ui/overlay";
import type { MediaItem } from "@/features/media/api";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-context";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { AsasStore, type Selection } from "@/themes/asas/asas-store";
import type { Design, DesignData, MediaUrls, Section, SectionType, Settings } from "@/themes/asas/types";
import { copySection, designKey, newSection, publishDesign, saveDesign, sectionErrors, settingsErrors, useDesign, type DesignPayload } from "./api";
import { SectionGallery, SectionIcon } from "./section-gallery";
import { BannerForm, FeaturesForm, ProductsForm, TestimonialsForm } from "./section-forms";
import { FooterForm, GeneralForm, HeaderForm, LookForm } from "./theme-forms";

const t = ar.design.builder;
const th = ar.design.theme;
const MAX_SECTIONS = 20;
const HISTORY = 60;

type Edit = Selection | "look" | "general";
type Status = "saved" | "dirty" | "saving" | "invalid" | "conflict";
type Device = "desktop" | "tablet" | "mobile";
type Tab = "sections" | "theme";

export function Builder() {
  const query = useDesign();
  if (query.isPending) {
    return (
      <div className="flex h-dvh flex-col">
        <Skeleton className="h-14 rounded-none" />
        <div className="flex flex-1 gap-4 p-4">
          <Skeleton className="w-[26rem] rounded-xl" />
          <Skeleton className="flex-1 rounded-xl" />
        </div>
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      </div>
    );
  }
  return <Editor initial={query.data} />;
}

function Editor({ initial }: { initial: DesignPayload }) {
  const client = useQueryClient();
  const session = useSession();
  const [draft, setDraft] = React.useState<Design>(initial.draft);
  const [data, setData] = React.useState<DesignData>(initial.data);
  const [published, setPublished] = React.useState({ at: initial.published_at, pending: initial.has_unpublished_changes });
  const [media, setMedia] = React.useState<Record<string, MediaUrls>>({});
  const [selected, setSelected] = React.useState<Edit>(null);
  const [tab, setTab] = React.useState<Tab>("sections");
  const [device, setDevice] = React.useState<Device>("desktop");
  const [status, setStatus] = React.useState<Status>("saved");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [publishing, setPublishing] = React.useState(false);
  const [removing, setRemoving] = React.useState<Section | null>(null);
  const [gallery, setGallery] = React.useState(false);
  const version = React.useRef(initial.version);
  const pending = React.useRef<Design | null>(null);
  const saving = React.useRef<Promise<boolean> | null>(null);
  const frame = React.useRef<HTMLDivElement>(null);
  // Undo / redo: snapshots of the whole design; quick edits in a row (typing) make one step.
  const [history, setHistory] = React.useState<{ past: Design[]; future: Design[] }>({ past: [], future: [] });
  const lastStep = React.useRef(0);

  const allMedia = React.useMemo(() => ({ ...data.media, ...media }), [data.media, media]);
  const rememberMedia = React.useCallback((item: MediaItem) => setMedia((m) => ({ ...m, [String(item.id)]: item.urls })), []);

  /** Saves the latest draft; later edits wait and are saved right after (one request at a time). */
  const flush = React.useCallback(async (): Promise<boolean> => {
    if (saving.current) await saving.current;
    const next = pending.current;
    if (!next) return true;
    pending.current = null;
    setStatus("saving");
    const run = (async () => {
      try {
        const res = await saveDesign(next, version.current);
        version.current = res.version;
        setData(res.data);
        setPublished({ at: res.published_at, pending: res.has_unpublished_changes });
        setErrors({});
        client.setQueryData(designKey, res);
        setStatus(pending.current ? "dirty" : "saved");
        return true;
      } catch (error) {
        if (isApiError(error) && error.status === 409) setStatus("conflict");
        else if (isApiError(error) && error.isValidation) {
          setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, v]) => [k, v[0] ?? ""])));
          setStatus("invalid");
        } else {
          toast.error(errorMessage(error));
          pending.current ??= next;
          setStatus("dirty");
        }
        return false;
      } finally {
        saving.current = null;
      }
    })();
    saving.current = run;
    return run;
  }, [client]);

  // Autosave: a short pause after the last edit.
  React.useEffect(() => {
    if (status !== "dirty") return;
    const timer = window.setTimeout(() => void flush(), 700);
    return () => window.clearTimeout(timer);
  }, [draft, status, flush]);

  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current || saving.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const apply = (next: Design) => {
    setDraft(next);
    pending.current = next;
    setStatus((s) => (s === "conflict" ? s : "dirty"));
  };

  /** `typing`: edits in the settings forms; quick ones in a row make one undo step. Moves, adds and deletes are steps of their own. */
  const change = (next: Design, typing = false) => {
    const now = Date.now();
    if (!typing || now - lastStep.current > 800) setHistory((h) => ({ past: [...h.past, draft].slice(-HISTORY), future: [] }));
    else setHistory((h) => (h.future.length ? { ...h, future: [] } : h));
    lastStep.current = typing ? now : 0;
    apply(next);
  };

  const undo = () => {
    const previous = history.past.at(-1);
    if (!previous) return;
    setHistory({ past: history.past.slice(0, -1), future: [draft, ...history.future] });
    lastStep.current = 0;
    apply(previous);
  };
  const redo = () => {
    const next = history.future[0];
    if (!next) return;
    setHistory({ past: [...history.past, draft], future: history.future.slice(1) });
    lastStep.current = 0;
    apply(next);
  };

  // Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) outside text fields; Esc closes the settings.
  const keys = React.useRef({ undo, redo });
  keys.current = { undo, redo };
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element ? e.target.closest("input, textarea, select, [contenteditable=true]") : null;
      if (e.key === "Escape" && !document.querySelector("[role=dialog], [role=alertdialog], [role=menu]")) setSelected(null);
      if (typing || !(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        keys.current.undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        keys.current.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setSettings = (settings: Settings) => change({ ...draft, settings }, true);
  const setSection = (id: string, props: Section["props"]) => change({ ...draft, sections: draft.sections.map((s) => (s.id === id ? ({ ...s, props } as Section) : s)) }, true);
  const toggle = (id: string) => change({ ...draft, sections: draft.sections.map((x) => (x.id === id ? { ...x, visible: !x.visible } : x)) });
  const move = (id: string, by: -1 | 1) => {
    const from = draft.sections.findIndex((s) => s.id === id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= draft.sections.length) return;
    const sections = [...draft.sections];
    [sections[from], sections[to]] = [sections[to], sections[from]];
    change({ ...draft, sections });
    window.setTimeout(() => scrollTo(id), 60);
  };
  const duplicate = (s: Section) => {
    if (draft.sections.length >= MAX_SECTIONS) return;
    const copy = copySection(s);
    const at = draft.sections.indexOf(s) + 1;
    change({ ...draft, sections: [...draft.sections.slice(0, at), copy, ...draft.sections.slice(at)] });
    setSelected(copy.id);
    window.setTimeout(() => scrollTo(copy.id), 60);
  };

  /** Scrolls the preview only (scrollIntoView would also move the page around it). */
  function scrollTo(id: Selection) {
    if (!id) return;
    const box = frame.current;
    const el = box?.querySelector(id === "header" ? "header" : id === "footer" ? "footer" : `#section-${CSS.escape(id)}`);
    if (box && el) box.scrollTo?.({ top: el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 12, behavior: "smooth" });
  }

  function select(id: Edit) {
    setSelected(id);
    if (id === "look" || id === "general") setTab("theme");
    else if (id) {
      setTab("sections");
      scrollTo(id);
    }
  }

  function add(type: SectionType) {
    const section = newSection(type);
    change({ ...draft, sections: [...draft.sections, section] });
    setGallery(false);
    setSelected(section.id);
    setTab("sections");
    window.setTimeout(() => scrollTo(section.id), 80);
  }

  async function publish() {
    setPublishing(true);
    try {
      if (!(await flush())) return;
      const res = await publishDesign();
      version.current = res.version;
      setPublished({ at: res.published_at, pending: false });
      client.setQueryData(designKey, res);
      await client.invalidateQueries({ queryKey: ["store"] });
      toast.success(t.published);
    } catch (error) {
      if (isApiError(error) && error.isValidation) {
        setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, v]) => [k, v[0] ?? ""])));
        setStatus("invalid");
      }
      toast.error(errorMessage(error));
    } finally {
      setPublishing(false);
    }
  }

  const index = draft.sections.findIndex((s) => s.id === selected);
  const section = index >= 0 ? draft.sections[index] : null;
  const hasPending = published.pending || status !== "saved" || published.at === null;
  const canPublish = status !== "conflict" && status !== "invalid" && hasPending;
  const host = session.storeUrl ? session.storeUrl.replace(/^https?:\/\//, "") : initial.store_name;

  /** The quick actions over the selected part of the preview. */
  const tools = (id: Selection) => {
    if (id === "header" || id === "footer") return <CanvasChip icon={id === "header" ? LayoutPanelTop : PanelBottom} label={id === "header" ? t.header : t.footer} />;
    const s = draft.sections.find((x) => x.id === id);
    if (!s) return null;
    const i = draft.sections.indexOf(s);
    return (
      <div className="flex items-center gap-0.5 rounded-lg bg-ink p-1 text-white shadow-lg" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <span className="flex items-center gap-1.5 px-2 text-xs font-semibold">
          <SectionIcon type={s.type} size="sm" />
          {t.types[s.type].title}
        </span>
        <span className="mx-0.5 h-5 w-px bg-white/20" aria-hidden />
        <ToolButton icon={ArrowUp} label={t.moveUp} disabled={i === 0} onClick={() => move(s.id, -1)} />
        <ToolButton icon={ArrowDown} label={t.moveDown} disabled={i === draft.sections.length - 1} onClick={() => move(s.id, 1)} />
        <ToolButton icon={Copy} label={t.duplicate} disabled={draft.sections.length >= MAX_SECTIONS} onClick={() => duplicate(s)} />
        <ToolButton icon={EyeOff} label={t.hide} onClick={() => toggle(s.id)} />
        <ToolButton icon={Trash2} label={t.remove} danger onClick={() => setRemoving(s)} />
      </div>
    );
  };

  return (
    <div className="flex h-dvh flex-col bg-surface-2">
      {/* Top bar */}
      <header className="relative flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
        <Tooltip content={t.back}>
          <Button asChild size="icon" variant="ghost" aria-label={t.back}>
            <Link href="/dashboard/design/theme">
              <ArrowRight />
            </Link>
          </Button>
        </Tooltip>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-display text-sm font-semibold">{initial.store_name}</span>
          <span className="truncate text-xs text-ink-3">
            {initial.theme.name} · {t.homePage}
          </span>
        </div>

        <div className="absolute inset-x-0 mx-auto hidden w-fit items-center gap-2 md:flex">
          <div className="flex rounded-lg bg-surface-2 p-0.5" role="radiogroup" aria-label={t.device}>
            {(["desktop", "tablet", "mobile"] as const).map((d) => {
              const Icon = d === "desktop" ? Laptop : d === "tablet" ? Tablet : Smartphone;
              return (
                <Tooltip key={d} content={t[d]}>
                  <button type="button" role="radio" aria-checked={device === d} aria-label={t[d]} onClick={() => setDevice(d)} className={cn("flex h-8 w-9 items-center justify-center rounded-md transition", device === d ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink")}>
                    <Icon className="size-4" />
                  </button>
                </Tooltip>
              );
            })}
          </div>
          <span className="h-6 w-px bg-border" aria-hidden />
          <Tooltip content={`${t.undo} (${t.shortcutUndo})`}>
            <Button size="icon-sm" variant="ghost" aria-label={t.undo} disabled={history.past.length === 0} onClick={undo}>
              <Undo2 />
            </Button>
          </Tooltip>
          <Tooltip content={`${t.redo} (${t.shortcutRedo})`}>
            <Button size="icon-sm" variant="ghost" aria-label={t.redo} disabled={history.future.length === 0} onClick={redo}>
              <Redo2 />
            </Button>
          </Tooltip>
        </div>

        <div className="relative ms-auto flex items-center gap-2">
          <SaveStatus status={status} />
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/design/preview" target="_blank" onClick={() => void flush()}>
              <ExternalLink />
              {t.preview}
            </Link>
          </Button>
          <Tooltip content={published.at === null ? t.notPublished : hasPending ? t.pendingChanges : `${t.upToDate} · ${t.lastPublished(formatDateTime(published.at))}`}>
            <span className="relative">
              <Button size="sm" loading={publishing} disabled={!canPublish} onClick={() => void publish()}>
                <Rocket />
                {t.publish}
              </Button>
              {canPublish ? <span className="absolute -end-1 -top-1 size-2.5 rounded-full bg-accent ring-2 ring-surface" aria-hidden /> : null}
            </span>
          </Tooltip>
        </div>
      </header>

      {status === "conflict" ? (
        <Alert tone="warning" className="m-3">
          <span className="flex flex-wrap items-center gap-2">
            {t.conflict}
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              {t.reload}
            </Button>
          </span>
        </Alert>
      ) : null}

      <p className="p-6 text-center text-sm text-ink-2 md:hidden">{t.smallScreen}</p>

      <div className="hidden min-h-0 flex-1 md:flex">
        {/* Rail */}
        <nav className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1 border-e border-border bg-surface py-3" aria-label={t.tabs.sections}>
          <RailButton icon={LayoutList} label={t.rail.sections} active={tab === "sections"} onClick={() => (setTab("sections"), setSelected(null))} />
          <RailButton icon={Palette} label={t.rail.theme} active={tab === "theme"} onClick={() => (setTab("theme"), setSelected(null))} />
        </nav>

        {/* Panel: the list, or the settings of what is selected */}
        <aside className="flex w-[22rem] shrink-0 flex-col border-e border-border bg-surface">
          {selected ? (
            <Inspector
              title={editorTitle(selected, section)}
              icon={section ? <SectionIcon type={section.type} size="sm" /> : <PanelIcon icon={selected === "header" ? LayoutPanelTop : selected === "footer" ? PanelBottom : selected === "look" ? Palette : Settings2} />}
              back={tab === "theme" ? t.tabs.theme : t.homePage}
              onBack={() => setSelected(null)}
              actions={
                section ? (
                  <>
                    <Tooltip content={section.visible ? t.hide : t.show}>
                      <Button size="icon-sm" variant="ghost" aria-label={section.visible ? t.hide : t.show} onClick={() => toggle(section.id)}>
                        {section.visible ? <Eye /> : <EyeOff />}
                      </Button>
                    </Tooltip>
                    <Tooltip content={t.duplicate}>
                      <Button size="icon-sm" variant="ghost" aria-label={t.duplicate} disabled={draft.sections.length >= MAX_SECTIONS} onClick={() => duplicate(section)}>
                        <Copy />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t.remove}>
                      <Button size="icon-sm" variant="ghost" className="hover:text-danger" aria-label={t.remove} onClick={() => setRemoving(section)}>
                        <Trash2 />
                      </Button>
                    </Tooltip>
                  </>
                ) : null
              }
            >
              {selected === "look" ? (
                <LookForm settings={draft.settings} onChange={setSettings} errors={settingsErrors(errors)} media={allMedia} onMedia={rememberMedia} />
              ) : selected === "general" ? (
                <GeneralForm settings={draft.settings} onChange={setSettings} errors={settingsErrors(errors)} />
              ) : selected === "header" ? (
                <HeaderForm settings={draft.settings} onChange={setSettings} errors={settingsErrors(errors)} />
              ) : selected === "footer" ? (
                <FooterForm settings={draft.settings} onChange={setSettings} errors={settingsErrors(errors)} />
              ) : section ? (
                <SectionForm section={section} errors={sectionErrors(errors, index)} onChange={(props) => setSection(section.id, props)} media={allMedia} onMedia={rememberMedia} />
              ) : null}
            </Inspector>
          ) : tab === "sections" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <PanelTitle title={t.homePage} hint={t.homePageHint} badge={t.sectionsCount(draft.sections.length)} />
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-4">
                <PinnedRow icon={LayoutPanelTop} label={t.header} onClick={() => select("header")} />
                {draft.sections.length ? (
                  <SortableList
                    items={draft.sections}
                    getId={(s) => s.id}
                    onReorder={(sections) => change({ ...draft, sections })}
                    render={(s) => {
                      const i = draft.sections.indexOf(s);
                      const hasError = Object.keys(errors).some((k) => k.startsWith(`draft.sections.${i}.`));
                      return (
                        <div className="group flex items-center gap-2">
                          <button type="button" onClick={() => select(s.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
                            <span className={cn(!s.visible && "opacity-40")}>
                              <SectionIcon type={s.type} size="sm" />
                            </span>
                            <span className="flex min-w-0 flex-col leading-tight">
                              <span className={cn("truncate text-sm font-semibold", !s.visible && "text-ink-3")}>{sectionTitle(s)}</span>
                              <span className="truncate text-xs text-ink-3">{s.visible ? t.types[s.type].title : `${t.types[s.type].title} · ${t.hidden}`}</span>
                            </span>
                          </button>
                          {hasError ? <TriangleAlert className="size-4 shrink-0 text-danger" aria-label={t.invalid} /> : null}
                          <Button size="icon-sm" variant="ghost" className={cn(s.visible && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100")} aria-label={s.visible ? t.hide : t.show} onClick={() => toggle(s.id)}>
                            {s.visible ? <Eye /> : <EyeOff />}
                          </Button>
                          <Menu>
                            <MenuTrigger asChild>
                              <Button size="icon-sm" variant="ghost" aria-label={ar.common.actions}>
                                <MoreHorizontal />
                              </Button>
                            </MenuTrigger>
                            <MenuContent>
                              <MenuItem disabled={i === 0} onSelect={() => move(s.id, -1)}>
                                <ArrowUp />
                                {t.moveUp}
                              </MenuItem>
                              <MenuItem disabled={i === draft.sections.length - 1} onSelect={() => move(s.id, 1)}>
                                <ArrowDown />
                                {t.moveDown}
                              </MenuItem>
                              <MenuItem disabled={draft.sections.length >= MAX_SECTIONS} onSelect={() => duplicate(s)}>
                                <Copy />
                                {t.duplicate}
                              </MenuItem>
                              <MenuSeparator />
                              <MenuItem destructive onSelect={() => setRemoving(s)}>
                                <Trash2 />
                                {t.remove}
                              </MenuItem>
                            </MenuContent>
                          </Menu>
                        </div>
                      );
                    }}
                  />
                ) : (
                  <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-ink-3">{t.emptyCanvas}</p>
                )}
                <PinnedRow icon={PanelBottom} label={t.footer} onClick={() => select("footer")} />
                <button
                  type="button"
                  onClick={() => setGallery(true)}
                  disabled={draft.sections.length >= MAX_SECTIONS}
                  className="mt-1 flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong text-sm font-semibold text-ink-2 transition hover:border-brand hover:bg-brand-soft/40 hover:text-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="size-4" />
                  {t.addSection}
                </button>
                {draft.sections.length >= MAX_SECTIONS ? <p className="text-center text-xs text-ink-3">{t.maxSections}</p> : null}
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <PanelTitle title={t.tabs.theme} hint={t.themeHint} />
              <ul className="flex flex-col gap-1.5 overflow-y-auto px-3 pb-4">
                {(
                  [
                    ["look", Palette, th.tabs.look, t.groups.look],
                    ["header", LayoutPanelTop, th.tabs.header, t.groups.header],
                    ["footer", PanelBottom, th.tabs.footer, t.groups.footer],
                    ["general", Settings2, th.tabs.general, t.groups.general],
                  ] as Array<[Edit, LucideIcon, string, string]>
                ).map(([key, Icon, label, hint]) => (
                  <li key={String(key)}>
                    <button type="button" onClick={() => setSelected(key)} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-start transition hover:border-border-strong hover:bg-surface-2/60">
                      <PanelIcon icon={Icon} />
                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="text-sm font-semibold">{label}</span>
                        <span className="truncate text-xs text-ink-3">{hint}</span>
                      </span>
                      <ChevronLeft className="size-4 text-ink-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* Canvas */}
        <main className="relative min-w-0 flex-1 overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:18px_18px] p-5">
          <DeviceFrame device={device} host={host}>
            <div ref={frame} className="h-full overflow-y-auto">
              <AsasStore
                design={draft}
                data={data}
                storeName={initial.store_name}
                mode="builder"
                selected={selected === "look" || selected === "general" ? null : selected}
                onSelect={(id) => select(id)}
                media={media}
                tools={tools}
              />
            </div>
          </DeviceFrame>
        </main>
      </div>

      <SectionGallery open={gallery} onOpenChange={setGallery} onPick={add} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t.removeTitle}
        description={removing ? sectionTitle(removing) : undefined}
        confirmLabel={t.remove}
        destructive
        onConfirm={() => {
          if (!removing) return;
          change({ ...draft, sections: draft.sections.filter((s) => s.id !== removing.id) });
          if (selected === removing.id) setSelected(null);
          setRemoving(null);
        }}
      />
    </div>
  );
}

function SectionForm({ section, errors, onChange, media, onMedia }: { section: Section; errors: Record<string, string>; onChange: (props: Section["props"]) => void; media: Record<string, MediaUrls>; onMedia: (item: MediaItem) => void }) {
  switch (section.type) {
    case "banner":
      return <BannerForm props={section.props} onChange={onChange} errors={errors} media={media} onMedia={onMedia} />;
    case "products":
      return <ProductsForm props={section.props} onChange={onChange} errors={errors} />;
    case "features":
      return <FeaturesForm props={section.props} onChange={onChange} errors={errors} />;
    case "testimonials":
      return <TestimonialsForm props={section.props} onChange={onChange} errors={errors} />;
  }
}

/** The section's own title when it has one, else its type. */
function sectionTitle(s: Section): string {
  const custom = s.type === "products" ? s.props.title : s.type === "features" || s.type === "testimonials" ? s.props.title : null;
  return custom || t.types[s.type].title;
}

function editorTitle(selected: Edit, section: Section | null): string {
  if (selected === "look") return th.tabs.look;
  if (selected === "general") return th.tabs.general;
  if (selected === "header") return t.header;
  if (selected === "footer") return t.footer;
  return section ? sectionTitle(section) : t.tabs.sections;
}

/* ---------- Pieces ---------- */

function RailButton({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition", active ? "bg-brand-soft text-brand-strong" : "text-ink-3 hover:bg-surface-2 hover:text-ink")}
    >
      <Icon className="size-5" />
      {label}
    </button>
  );
}

function PanelTitle({ title, hint, badge }: { title: string; hint: string; badge?: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 pb-3 pt-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {badge ? <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-3">{badge}</span> : null}
      </div>
      <p className="text-xs leading-relaxed text-ink-3">{hint}</p>
    </div>
  );
}

function PanelIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2" aria-hidden>
      <Icon className="size-3.5" />
    </span>
  );
}

/** Header and footer: always there, not moved, opened like a section. */
function PinnedRow({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5 text-start transition hover:border-border-strong hover:bg-surface-2">
      <PanelIcon icon={Icon} />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-ink-3">{t.pinned}</span>
      </span>
      <ChevronLeft className="size-4 text-ink-3" aria-hidden />
    </button>
  );
}

function Inspector({ title, icon, back, onBack, actions, children }: { title: string; icon: React.ReactNode; back: string; onBack: () => void; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-3 pb-3 pt-2">
        <button type="button" onClick={onBack} className="mb-2 flex items-center gap-1 rounded-md px-1 py-1 text-xs font-semibold text-ink-3 hover:text-ink">
          <ArrowRight className="size-3.5" />
          {t.backTo(back)}
        </button>
        <div className="flex items-center gap-2 px-1">
          {icon}
          <h2 className="min-w-0 flex-1 truncate font-display text-base font-semibold">{title}</h2>
          {actions}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

function ToolButton({ icon: Icon, label, onClick, disabled = false, danger = false }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className={cn("flex size-7 items-center justify-center rounded-md transition hover:bg-white/15 disabled:opacity-30", danger && "hover:bg-red-500/80")}>
      <Icon className="size-3.5" />
    </button>
  );
}

function CanvasChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg" dir="rtl">
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

/** The preview inside a browser window, a tablet or a phone. */
function DeviceFrame({ device, host, children }: { device: Device; host: string; children: React.ReactNode }) {
  if (device === "desktop") {
    return (
      <div className="mx-auto flex h-full max-w-[1280px] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-xl">
        <div className="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-surface-2 px-3" dir="ltr">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="mx-auto w-full max-w-sm truncate rounded-md bg-surface px-3 py-0.5 text-center text-[11px] text-ink-3">{host}</span>
          <span className="w-12" aria-hidden />
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    );
  }
  const phone = device === "mobile";
  return (
    <div className={cn("mx-auto flex h-full flex-col overflow-hidden bg-white shadow-2xl ring-ink transition-[width] duration-300", phone ? "w-[390px] rounded-[2.4rem] ring-[10px]" : "w-[820px] max-w-full rounded-[1.6rem] ring-[12px]")}>
      {phone ? <div className="mx-auto mt-1.5 h-5 w-28 shrink-0 rounded-full bg-ink" aria-hidden /> : null}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function SaveStatus({ status }: { status: Status }) {
  const base = "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";
  if (status === "saving" || status === "dirty")
    return (
      <span className={cn(base, "bg-surface-2 text-ink-3")}>
        <Loader2 className="size-3.5 animate-spin" />
        {status === "saving" ? t.saving : t.unsaved}
      </span>
    );
  if (status === "invalid")
    return (
      <span className={cn(base, "bg-danger-soft text-danger")}>
        <TriangleAlert className="size-3.5" />
        {t.invalid}
      </span>
    );
  if (status === "conflict") return null;
  return (
    <span className={cn(base, "bg-success-soft text-success")}>
      <CheckCircle2 className="size-3.5" />
      {t.saved}
    </span>
  );
}
