"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  LayoutList,
  LayoutPanelTop,
  Laptop,
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
import type { Selection } from "@/themes/store/asas/asas-store";
import { storeTheme } from "@/themes/store/registry";
import type { MediaUrls } from "@/themes/shared/design";
import type { DesignData, StoreSettings } from "@/themes/store/shared/types";
import type { Design } from "@/themes/store/asas/types";
import { copySection, designKey, publishDesign, saveDesign, sectionErrors, settingsErrors, useDesign, type AnySection, type DesignPayload } from "./api";
import { SectionGallery, SectionIcon, type AnySectionType } from "./section-gallery";
import { CanvasChip, DeviceFrame, GroupRow, Inspector, PanelIcon, PanelTitle, PinnedRow, RailButton, SaveStatus, ToolButton, useDraftEditor, type Device } from "./kit";
import { builderTheme } from "./themes";
import type { GroupKey } from "./themes/types";

const t = ar.design.builder;
const th = ar.design.theme;

type Edit = Selection | GroupKey;

/** How each settings group shows in the Builder (a theme lists the groups it has). */
const GROUP_META: Record<GroupKey, { icon: LucideIcon; label: string; hint: string }> = {
  look: { icon: Palette, label: th.tabs.look, hint: t.groups.look },
  header: { icon: LayoutPanelTop, label: th.tabs.header, hint: t.groups.header },
  footer: { icon: PanelBottom, label: th.tabs.footer, hint: t.groups.footer },
  general: { icon: Settings2, label: th.tabs.general, hint: t.groups.general },
};
/** Groups that are also parts of the canvas (clicking the preview selects them). */
const ON_CANVAS: Edit[] = ["header", "footer"];
/** The draft of any store theme (sections of «أساس» or «صوفي»). */
type AnyDesign = { settings: StoreSettings; sections: AnySection[] };
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
  const [data, setData] = React.useState<DesignData>(initial.data);
  const [published, setPublished] = React.useState({ at: initial.published_at, pending: initial.has_unpublished_changes });
  const [media, setMedia] = React.useState<Record<string, MediaUrls>>({});
  const [selected, setSelected] = React.useState<Edit>(null);
  const [tab, setTab] = React.useState<Tab>("sections");
  const [device, setDevice] = React.useState<Device>("desktop");
  const [publishing, setPublishing] = React.useState(false);
  const [removing, setRemoving] = React.useState<AnySection | null>(null);
  const { Canvas } = storeTheme(initial.theme.key);
  const theme = builderTheme(initial.theme.key);
  const MAX_SECTIONS = initial.theme.max_sections;
  const [gallery, setGallery] = React.useState(false);
  const frame = React.useRef<HTMLDivElement>(null);
  const editor = useDraftEditor<AnyDesign, DesignPayload>({
    initial: initial.draft as AnyDesign,
    version: initial.version,
    save: (d, v) => saveDesign(d as Design, v),
    onSaved: (res) => {
      setData(res.data);
      setPublished({ at: res.published_at, pending: res.has_unpublished_changes });
      client.setQueryData(designKey, res);
    },
    onEscape: () => setSelected(null),
  });
  const { draft, change, undo, redo, status, errors, flush } = editor;

  const allMedia = React.useMemo(() => ({ ...data.media, ...media }), [data.media, media]);
  const rememberMedia = React.useCallback((item: MediaItem) => setMedia((m) => ({ ...m, [String(item.id)]: item.urls })), []);

  const setSettings = (settings: StoreSettings) => change({ ...draft, settings }, true);
  const setSection = (id: string, props: AnySection["props"]) => change({ ...draft, sections: draft.sections.map((s) => (s.id === id ? ({ ...s, props } as AnySection) : s)) }, true);
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
  const duplicate = (s: AnySection) => {
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
    if (id && !ON_CANVAS.includes(id) && theme.groups.some((g) => g.key === id)) setTab("theme");
    else if (id) {
      setTab("sections");
      scrollTo(id);
    }
  }

  function add(type: AnySectionType) {
    const section = theme.newSection(type);
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
      editor.setVersion(res.version);
      setPublished({ at: res.published_at, pending: false });
      client.setQueryData(designKey, res);
      await client.invalidateQueries({ queryKey: ["store"] });
      toast.success(t.published);
    } catch (error) {
      if (isApiError(error) && error.isValidation) {
        editor.setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, v]) => [k, v[0] ?? ""])));
        editor.setStatus("invalid");
      }
      toast.error(errorMessage(error));
    } finally {
      setPublishing(false);
    }
  }

  const index = draft.sections.findIndex((s) => s.id === selected);
  const section = index >= 0 ? draft.sections[index] : null;
  const group = section ? null : (theme.groups.find((g) => g.key === selected) ?? null);
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
            <Button size="icon-sm" variant="ghost" aria-label={t.undo} disabled={!editor.canUndo} onClick={undo}>
              <Undo2 />
            </Button>
          </Tooltip>
          <Tooltip content={`${t.redo} (${t.shortcutRedo})`}>
            <Button size="icon-sm" variant="ghost" aria-label={t.redo} disabled={!editor.canRedo} onClick={redo}>
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
              icon={section ? <SectionIcon type={section.type} size="sm" /> : <PanelIcon icon={group ? GROUP_META[group.key].icon : Settings2} />}
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
              {group ? (
                <group.Form settings={draft.settings} onChange={setSettings} errors={settingsErrors(errors)} media={allMedia} onMedia={rememberMedia} />
              ) : section ? (
                <theme.SectionForm section={section} errors={sectionErrors(errors, index)} onChange={(props) => setSection(section.id, props)} media={allMedia} onMedia={rememberMedia} />
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
                {theme.groups.map(({ key }) => (
                  <li key={key}>
                    <GroupRow icon={GROUP_META[key].icon} label={GROUP_META[key].label} hint={GROUP_META[key].hint} onClick={() => setSelected(key)} />
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
              <Canvas
                design={draft}
                data={data}
                storeName={initial.store_name}
                mode="builder"
                selected={section || (selected && ON_CANVAS.includes(selected)) ? selected : null}
                onSelect={(id) => select(id)}
                media={media}
                tools={tools}
              />
            </div>
          </DeviceFrame>
        </main>
      </div>

      <SectionGallery open={gallery} onOpenChange={setGallery} onPick={add} types={initial.theme.section_types as AnySectionType[]} />
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

/** The section's own title when it has one, else its type. */
function sectionTitle(s: AnySection): string {
  const custom = "title" in s.props && typeof s.props.title === "string" ? s.props.title : null;
  return custom || t.types[s.type].title;
}

function editorTitle(selected: Edit, section: AnySection | null): string {
  if (section) return sectionTitle(section);
  if (selected === "header") return t.header;
  if (selected === "footer") return t.footer;
  return selected && selected in GROUP_META ? GROUP_META[selected as GroupKey].label : t.tabs.sections;
}
