"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  BadgeCheck,
  ChartNoAxesColumn,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CircleHelp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileCog,
  Film,
  Flame,
  Footprints,
  Images,
  Laptop,
  LayoutList,
  LayoutPanelTop,
  ListChecks,
  Lock,
  MessageSquareQuote,
  Package,
  MoreHorizontal,
  Palette,
  PanelBottom,
  Plus,
  Redo2,
  Rocket,
  ScanSearch,
  Scale,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  TriangleAlert,
  Type,
  Undo2,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { SortableList } from "@/components/data/sortable-list";
import { Button } from "@/components/ui/button";
import { Alert, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogHeader, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tooltip } from "@/components/ui/overlay";
import { createAiSectionPlacement, useDesignerStatus, type AiMessageMedia, type MyAiSection } from "@/features/ai-designer/api";
import { DesignerDialog, type FocusedAiSection } from "@/features/ai-designer/designer-dialog";
import { AiSectionInspector } from "@/features/ai-designer/fields-form";
import { MySectionsGalleryBlock } from "@/features/ai-designer/my-sections";
import { CanvasChip, DeviceFrame, GroupRow, Inspector, PanelIcon, PanelTitle, PinnedRow, RailButton, SaveStatus, ToolButton, useDraftEditor, type Device } from "@/features/builder/kit";
import type { MediaItem } from "@/features/media/api";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-context";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import type { AiDefinition, AiSectionProps } from "@/themes/shared/ai-section/types";
import type { MediaUrls } from "@/themes/shared/design";
import type { Content, LandingData, Settings } from "@/themes/landing/bidaya/types";
import { landingTheme, type Selection } from "@/themes/landing/registry";
import { pageUrl } from "./api";
import { newId, pageKey, publishLandingPage, saveLandingContent, sectionErrors, settingsErrors, toLandingData, useLandingEditor, type PageDetail } from "./builder-api";
import { FooterForm, GeneralForm, HeaderForm, LookForm } from "./builder-forms";
import { PageSettingsForm } from "./page-settings";
import { landingBuilderTheme, type LandingSection } from "./themes";

const t = ar.landings.builder;
const tb = ar.design.builder;
/** A section of any landing theme the Builder edits (each theme's own shape, checked by the back end). */
type AnySection = LandingSection;
type AnyContent = { version: number; settings: Settings; sections: AnySection[] };

type Edit = Selection | "look" | "general";
type Tab = "sections" | "theme" | "page";

const LOOK: Record<string, { icon: LucideIcon; tint: string }> = {
  hero: { icon: Zap, tint: "bg-violet-100 text-violet-700" },
  marquee: { icon: Type, tint: "bg-orange-100 text-orange-700" },
  menu: { icon: UtensilsCrossed, tint: "bg-amber-100 text-amber-700" },
  why: { icon: Flame, tint: "bg-red-100 text-red-700" },
  steps: { icon: Footprints, tint: "bg-indigo-100 text-indigo-700" },
  bundles: { icon: Package, tint: "bg-lime-100 text-lime-700" },
  video: { icon: Film, tint: "bg-fuchsia-100 text-fuchsia-700" },
  compare: { icon: Scale, tint: "bg-slate-100 text-slate-700" },
  urgency: { icon: AlarmClock, tint: "bg-pink-100 text-pink-700" },
  guarantee: { icon: ShieldCheck, tint: "bg-cyan-100 text-cyan-700" },
  features: { icon: Sparkles, tint: "bg-amber-100 text-amber-700" },
  gallery: { icon: Images, tint: "bg-sky-100 text-sky-700" },
  testimonials: { icon: MessageSquareQuote, tint: "bg-rose-100 text-rose-700" },
  faq: { icon: CircleHelp, tint: "bg-teal-100 text-teal-700" },
  order_form: { icon: ShoppingBag, tint: "bg-emerald-100 text-emerald-700" },
  details: { icon: ScanSearch, tint: "bg-stone-100 text-stone-700" },
  specs: { icon: ListChecks, tint: "bg-zinc-100 text-zinc-700" },
  stats: { icon: ChartNoAxesColumn, tint: "bg-yellow-100 text-yellow-800" },
  countdown: { icon: AlarmClock, tint: "bg-pink-100 text-pink-700" },
  promises: { icon: BadgeCheck, tint: "bg-cyan-100 text-cyan-700" },
  ai: { icon: Sparkles, tint: "bg-gradient-to-br from-violet-100 to-pink-100 text-violet-700" },
};

const OTHER = { icon: Sparkles, tint: "bg-slate-100 text-slate-700" };

function TypeIcon({ type }: { type: string }) {
  const { icon: Icon, tint } = LOOK[type] ?? OTHER;
  return (
    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", tint)} aria-hidden>
      <Icon className="size-3.5" />
    </span>
  );
}

export function LandingBuilder({ id }: { id: number }) {
  const { page, preview } = useLandingEditor(id);
  if (page.isPending || preview.isPending) {
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
  if (page.isError || preview.isError) {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <ErrorState onRetry={() => void (page.isError ? page.refetch() : preview.refetch())} message={errorMessage(page.error ?? preview.error)} />
      </div>
    );
  }
  return <Editor initial={page.data} data={toLandingData(preview.data)} onDataStale={() => void preview.refetch()} />;
}

function Editor({ initial, data, onDataStale }: { initial: PageDetail; data: LandingData; onDataStale: () => void }) {
  const client = useQueryClient();
  const session = useSession();
  const [detail, setDetail] = React.useState(initial);
  const [published, setPublished] = React.useState({ at: initial.published_at, pending: initial.has_unpublished_changes || initial.status !== "published" });
  const [media, setMedia] = React.useState<Record<string, MediaUrls>>({});
  const [selected, setSelected] = React.useState<Edit>(null);
  const [tab, setTab] = React.useState<Tab>("sections");
  const [device, setDevice] = React.useState<Device>("desktop");
  const [publishing, setPublishing] = React.useState(false);
  const [blockers, setBlockers] = React.useState<string[]>([]);
  const [removing, setRemoving] = React.useState<AnySection | null>(null);
  const [gallery, setGallery] = React.useState(false);
  const [extraAiSections, setExtraAiSections] = React.useState<Record<string, AiDefinition>>({});
  const [extraAiCurrent, setExtraAiCurrent] = React.useState<Record<string, number>>({});
  const aiStatus = useDesignerStatus();
  const aiEnabled = Boolean(aiStatus.data?.enabled);
  const [designerOpen, setDesignerOpen] = React.useState(false);
  const [designerInsert, setDesignerInsert] = React.useState<"after_selected" | "end">("end");
  const [designerFocus, setDesignerFocus] = React.useState<FocusedAiSection | null>(null);
  const frame = React.useRef<HTMLDivElement>(null);

  const theme = landingBuilderTheme(initial.theme_key);
  const { Page, aiTokens } = landingTheme(initial.theme_key);
  const extras = theme.extras ?? {};
  const maxSections = theme.maxSections;
  const editor = useDraftEditor<AnyContent, PageDetail>({
    initial: initial.draft_content as AnyContent,
    version: initial.version,
    save: (content, version) => saveLandingContent(initial.id, content as Content, version),
    onSaved: (res) => {
      setDetail(res);
      setPublished((p) => ({ ...p, pending: true }));
      client.setQueryData(pageKey(initial.id), res);
    },
    onEscape: () => setSelected(null),
  });
  const { draft, change, undo, redo, status, errors, flush } = editor;

  const allMedia = React.useMemo(() => ({ ...Object.fromEntries(Object.entries(data.media).map(([k, v]) => [k, v.urls])), ...media }), [data.media, media]);
  const rememberMedia = React.useCallback((item: MediaItem) => setMedia((m) => ({ ...m, [String(item.id)]: item.urls })), []);
  const pageData: LandingData = React.useMemo(
    () => ({
      ...data,
      page: { ...data.page, slug: detail.slug, title: detail.title },
      ai_sections: { ...(data.ai_sections ?? {}), ...extraAiSections },
      ai_sections_current: { ...(data.ai_sections_current ?? {}), ...extraAiCurrent },
    }),
    [data, detail.slug, detail.title, extraAiSections, extraAiCurrent],
  );

  const setSettings = (settings: Settings) => change({ ...draft, settings }, true);
  const setSection = (sid: string, props: AnySection["props"]) => change({ ...draft, sections: draft.sections.map((s) => (s.id === sid ? ({ ...s, props } as AnySection) : s)) }, true);
  const toggle = (sid: string) => change({ ...draft, sections: draft.sections.map((x) => (x.id === sid && x.type !== "order_form" ? { ...x, visible: !x.visible } : x)) });
  const move = (sid: string, by: -1 | 1) => {
    const from = draft.sections.findIndex((s) => s.id === sid);
    const to = from + by;
    if (from < 0 || to < 0 || to >= draft.sections.length) return;
    const sections = [...draft.sections];
    [sections[from], sections[to]] = [sections[to], sections[from]];
    change({ ...draft, sections });
    window.setTimeout(() => scrollTo(sid), 60);
  };
  const duplicate = (s: AnySection) => {
    if (s.type === "order_form" || draft.sections.length >= maxSections) return;
    const copy = { ...structuredClone(s), id: newId() } as AnySection;
    const at = draft.sections.indexOf(s) + 1;
    change({ ...draft, sections: [...draft.sections.slice(0, at), copy, ...draft.sections.slice(at)] });
    setSelected(copy.id);
    window.setTimeout(() => scrollTo(copy.id), 60);
  };

  function scrollTo(target: Selection) {
    if (!target) return;
    const box = frame.current;
    const el = box?.querySelector(target === "header" ? "header" : target === "footer" ? "footer" : `#section-${CSS.escape(target)}`);
    if (box && el) box.scrollTo?.({ top: el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 12, behavior: "smooth" });
  }

  function select(target: Edit) {
    setSelected(target);
    if (target === "look" || target === "general") setTab("theme");
    else if (target) {
      setTab("sections");
      scrollTo(target);
    }
  }

  function add(type: string) {
    const section = theme.newSection(type, data.product?.name ?? null);
    // New sections go just above the order form, so the form stays the page's end.
    const formAt = draft.sections.findIndex((s) => s.type === "order_form");
    const at = formAt < 0 ? draft.sections.length : formAt;
    change({ ...draft, sections: [...draft.sections.slice(0, at), section, ...draft.sections.slice(at)] });
    setGallery(false);
    setSelected(section.id);
    setTab("sections");
    window.setTimeout(() => scrollTo(section.id), 80);
  }

  function addMySection(saved: MyAiSection) {
    if (draft.sections.length >= maxSections) return;
    setExtraAiSections((prev) => ({ ...prev, [String(saved.current.id)]: saved.current }));
    setExtraAiCurrent((prev) => ({ ...prev, [String(saved.id)]: saved.current.id }));
    const placement = createAiSectionPlacement(saved.id) as unknown as AnySection;
    const selectedIdx = draft.sections.findIndex((s) => s.id === selected && s.type !== "order_form");
    const formAt = draft.sections.findIndex((s) => s.type === "order_form");
    const defaultAt = formAt < 0 ? draft.sections.length : formAt;
    const at = selectedIdx >= 0 ? selectedIdx + 1 : defaultAt;
    change({ ...draft, sections: [...draft.sections.slice(0, at), placement, ...draft.sections.slice(at)] });
    setGallery(false);
    setSelected(placement.id);
    setTab("sections");
    toast.success(ar.aiDesigner.mySections.added);
    window.setTimeout(() => scrollTo(placement.id), 80);
  }

  function handleAiApproved(
    approvedSection: { id: number; name: string; current: AiDefinition },
    isNew: boolean,
    chatMedia?: Record<string, MediaUrls>,
  ) {
    if (chatMedia) {
      for (const [mid, urls] of Object.entries(chatMedia)) {
        rememberMedia({ id: Number(mid), urls });
      }
    }

    setExtraAiSections((prev) => ({
      ...prev,
      [String(approvedSection.current.id)]: approvedSection.current,
    }));
    setExtraAiCurrent((prev) => ({
      ...prev,
      [String(approvedSection.id)]: approvedSection.current.id,
    }));

    if (isNew && draft.sections.length < maxSections) {
      const placement = createAiSectionPlacement(approvedSection.id) as unknown as AnySection;
      const selectedIdx =
        designerInsert === "after_selected"
          ? draft.sections.findIndex((s) => s.id === selected && s.type !== "order_form")
          : -1;
      const formAt = draft.sections.findIndex((s) => s.type === "order_form");
      const defaultAt = formAt < 0 ? draft.sections.length : formAt;
      const at = selectedIdx >= 0 ? selectedIdx + 1 : defaultAt;
      change({
        ...draft,
        sections: [...draft.sections.slice(0, at), placement, ...draft.sections.slice(at)],
      });
      setSelected(placement.id);
      setTab("sections");
      window.setTimeout(() => scrollTo(placement.id), 80);
    }
  }

  function handleUseAiImage(img: AiMessageMedia) {
    if (img.urls) {
      rememberMedia({ id: img.id, urls: img.urls });
    }

    const targetIdx = draft.sections.findIndex((s) => {
      if (
        designerFocus &&
        s.type === "ai" &&
        (s.props as unknown as AiSectionProps).ai_section_id === designerFocus.id
      ) {
        return true;
      }
      return s.id === selected;
    });

    if (targetIdx < 0) return;
    const target = draft.sections[targetIdx]!;

    if (target.type === "ai") {
      const aiProps = target.props as unknown as AiSectionProps;
      const vId =
        aiProps.version_id ?? pageData.ai_sections_current?.[String(aiProps.ai_section_id)];
      const def = vId !== undefined ? (pageData.ai_sections?.[String(vId)] ?? null) : null;
      const imgField = def?.fields.find((f) => f.type === "image" || f.type === "images");
      if (!imgField) return;
      const prevVals = aiProps.values ?? {};
      const nextVals =
        imgField.type === "images"
          ? {
              ...prevVals,
              [`${imgField.key}_media_ids`]: [
                ...(Array.isArray(prevVals[`${imgField.key}_media_ids`])
                  ? (prevVals[`${imgField.key}_media_ids`] as number[])
                  : []),
                img.id,
              ],
            }
          : {
              ...prevVals,
              [`${imgField.key}_media_id`]: img.id,
            };
      setSection(targetIdx, {
        ...target,
        props: { ...target.props, values: nextVals },
      });
      toast.success(ar.aiDesigner.images.usedToast);
      return;
    }

    if ("media_id" in target.props) {
      setSection(targetIdx, {
        ...target,
        props: { ...target.props, media_id: img.id },
      });
      toast.success(ar.aiDesigner.images.usedToast);
    }
  }

  async function publish() {
    setPublishing(true);
    setBlockers([]);
    try {
      if (!(await flush())) return;
      const res = await publishLandingPage(detail.id);
      editor.setVersion(res.version);
      setDetail(res);
      setPublished({ at: res.published_at, pending: false });
      client.setQueryData(pageKey(detail.id), res);
      await client.invalidateQueries({ queryKey: ["landings", "list"] });
      toast.success(t.published);
    } catch (error) {
      if (isApiError(error) && error.code === "publish_blocked") {
        const list = (error.body as { blockers?: Array<{ message: string }> }).blockers ?? [];
        setBlockers(list.map((b) => b.message));
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
  const live = pageUrl(session.storeUrl, detail.slug);
  const host = live ? live.replace(/^https?:\/\//, "") : detail.slug;

  const aiDefFor = (s: AnySection): AiDefinition | null => {
    if (s.type !== "ai") return null;
    const p = s.props as unknown as AiSectionProps;
    const vId = p.version_id ?? pageData.ai_sections_current?.[String(p.ai_section_id)];
    return vId !== undefined ? (pageData.ai_sections?.[String(vId)] ?? null) : null;
  };

  const title = (s: AnySection) => {
    if (s.type === "ai") {
      return aiDefFor(s)?.name ?? (t.types.ai?.title ?? "قسم بالذكاء الاصطناعي");
    }
    const own = typeof s.props.title === "string" ? s.props.title : null;
    return own || (t.types[s.type]?.title ?? s.type);
  };
  const typeName = (type: string) => t.types[type]?.title ?? type;
  const extraProps = { settings: draft.settings, onChange: setSettings, errors: settingsErrors(errors), media: allMedia, onMedia: rememberMedia };

  const tools = (target: Selection) => {
    if (target === "header" || target === "footer") return <CanvasChip icon={target === "header" ? LayoutPanelTop : PanelBottom} label={target === "header" ? tb.header : tb.footer} />;
    const s = draft.sections.find((x) => x.id === target);
    if (!s) return null;
    const i = draft.sections.indexOf(s);
    const form = s.type === "order_form";
    return (
      <div className="flex items-center gap-0.5 rounded-lg bg-ink p-1 text-white shadow-lg" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <span className="flex items-center gap-1.5 px-2 text-xs font-semibold">
          <TypeIcon type={s.type} />
          {typeName(s.type)}
        </span>
        <span className="mx-0.5 h-5 w-px bg-white/20" aria-hidden />
        <ToolButton icon={ArrowUp} label={tb.moveUp} disabled={i === 0} onClick={() => move(s.id, -1)} />
        <ToolButton icon={ArrowDown} label={tb.moveDown} disabled={i === draft.sections.length - 1} onClick={() => move(s.id, 1)} />
        {form ? null : (
          <>
            <ToolButton icon={Copy} label={tb.duplicate} disabled={draft.sections.length >= maxSections} onClick={() => duplicate(s)} />
            <ToolButton icon={EyeOff} label={tb.hide} onClick={() => toggle(s.id)} />
            <ToolButton icon={Trash2} label={tb.remove} danger onClick={() => setRemoving(s)} />
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-dvh flex-col bg-surface-2">
      <header className="relative flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
        <Tooltip content={t.back}>
          <Button asChild size="icon" variant="ghost" aria-label={t.back}>
            <Link href="/dashboard/marketing/landings">
              <ArrowRight />
            </Link>
          </Button>
        </Tooltip>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-display text-sm font-semibold">{detail.title}</span>
          <span className="truncate text-xs text-ink-3" dir="ltr">
            {host}
          </span>
        </div>

        <div className="absolute inset-x-0 mx-auto hidden w-fit items-center gap-2 md:flex">
          <div className="flex rounded-lg bg-surface-2 p-0.5" role="radiogroup" aria-label={tb.device}>
            {(["desktop", "tablet", "mobile"] as const).map((dv) => {
              const Icon = dv === "desktop" ? Laptop : dv === "tablet" ? Tablet : Smartphone;
              return (
                <Tooltip key={dv} content={tb[dv]}>
                  <button type="button" role="radio" aria-checked={device === dv} aria-label={tb[dv]} onClick={() => setDevice(dv)} className={cn("flex h-8 w-9 items-center justify-center rounded-md transition", device === dv ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink")}>
                    <Icon className="size-4" />
                  </button>
                </Tooltip>
              );
            })}
          </div>
          <span className="h-6 w-px bg-border" aria-hidden />
          <Tooltip content={`${tb.undo} (${tb.shortcutUndo})`}>
            <Button size="icon-sm" variant="ghost" aria-label={tb.undo} disabled={!editor.canUndo} onClick={undo}>
              <Undo2 />
            </Button>
          </Tooltip>
          <Tooltip content={`${tb.redo} (${tb.shortcutRedo})`}>
            <Button size="icon-sm" variant="ghost" aria-label={tb.redo} disabled={!editor.canRedo} onClick={redo}>
              <Redo2 />
            </Button>
          </Tooltip>
        </div>

        <div className="relative ms-auto flex items-center gap-2">
          <SaveStatus status={status} />
          {aiEnabled ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setDesignerInsert("end");
                setDesignerFocus(null);
                setDesignerOpen(true);
              }}
            >
              <Sparkles className="size-4 text-violet-600" />
              {ar.aiDesigner.topButton}
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/landings/${detail.id}/preview`} target="_blank" onClick={() => void flush()}>
              <Eye />
              {t.preview}
            </Link>
          </Button>
          {live && published.at ? (
            <Tooltip content={t.open}>
              <Button asChild size="icon-sm" variant="ghost" aria-label={t.open}>
                <a href={live} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                </a>
              </Button>
            </Tooltip>
          ) : null}
          <Tooltip content={published.at === null ? tb.notPublished : hasPending ? tb.pendingChanges : `${tb.upToDate} · ${tb.lastPublished(formatDateTime(published.at))}`}>
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
            {tb.conflict}
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              {tb.reload}
            </Button>
          </span>
        </Alert>
      ) : null}
      {blockers.length ? (
        <Alert tone="danger" title={t.blocked} className="m-3">
          <ul className="list-disc ps-4">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <p className="p-6 text-center text-sm text-ink-2 md:hidden">{tb.smallScreen}</p>

      <div className="hidden min-h-0 flex-1 md:flex">
        <nav className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1 border-e border-border bg-surface py-3" aria-label={t.rail.sections}>
          <RailButton icon={LayoutList} label={t.rail.sections} active={tab === "sections" && !["look", "general"].includes(String(selected))} onClick={() => (setTab("sections"), setSelected(null))} />
          <RailButton icon={Palette} label={t.rail.theme} active={tab === "theme"} onClick={() => (setTab("theme"), setSelected(null))} />
          <RailButton icon={FileCog} label={t.rail.page} active={tab === "page"} onClick={() => (setTab("page"), setSelected(null))} />
        </nav>

        <aside className="flex w-[22rem] shrink-0 flex-col border-e border-border bg-surface">
          {tab === "page" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <PanelTitle title={t.page.title} hint={t.page.hint} />
              <div className="flex-1 overflow-y-auto px-4 pb-6">
                <PageSettingsForm
                  page={detail}
                  host={(session.storeUrl ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  onSaved={(res) => {
                    setDetail(res);
                    client.setQueryData(pageKey(res.id), res);
                    void client.invalidateQueries({ queryKey: ["landings", "list"] });
                    onDataStale();
                  }}
                />
              </div>
            </div>
          ) : selected ? (
            <Inspector
              title={selected === "look" ? t.groups.look.title : selected === "general" ? t.groups.general.title : selected === "header" ? tb.header : selected === "footer" ? tb.footer : section ? title(section) : ""}
              icon={section ? <TypeIcon type={section.type} /> : <PanelIcon icon={selected === "header" ? LayoutPanelTop : selected === "footer" ? PanelBottom : selected === "look" ? Palette : Settings2} />}
              back={tab === "theme" ? t.rail.theme : t.rail.sections}
              onBack={() => setSelected(null)}
              actions={
                section && section.type !== "order_form" ? (
                  <>
                    <Tooltip content={section.visible ? tb.hide : tb.show}>
                      <Button size="icon-sm" variant="ghost" aria-label={section.visible ? tb.hide : tb.show} onClick={() => toggle(section.id)}>
                        {section.visible ? <Eye /> : <EyeOff />}
                      </Button>
                    </Tooltip>
                    <Tooltip content={tb.remove}>
                      <Button size="icon-sm" variant="ghost" className="hover:text-danger" aria-label={tb.remove} onClick={() => setRemoving(section)}>
                        <Trash2 />
                      </Button>
                    </Tooltip>
                  </>
                ) : null
              }
            >
              {selected === "look" ? (
                <>
                  <LookForm settings={draft.settings} onChange={setSettings} errors={settingsErrors(errors)} media={allMedia} onMedia={rememberMedia} />
                  {extras.look ? <extras.look {...extraProps} /> : null}
                </>
              ) : selected === "general" ? (
                <>
                  <GeneralForm settings={draft.settings} onChange={setSettings} errors={settingsErrors(errors)} />
                  {extras.general ? <extras.general {...extraProps} /> : null}
                </>
              ) : selected === "header" ? (
                <>
                  <HeaderForm settings={draft.settings} onChange={setSettings} errors={settingsErrors(errors)} />
                  {extras.header ? <extras.header {...extraProps} /> : null}
                </>
              ) : selected === "footer" ? (
                <>
                  <FooterForm settings={draft.settings} onChange={setSettings} errors={settingsErrors(errors)} />
                  {extras.footer ? <extras.footer {...extraProps} /> : null}
                </>
              ) : section ? (
                section.type === "ai" ? (
                  <AiSectionInspector
                    definition={aiDefFor(section)}
                    values={((section.props as unknown as AiSectionProps).values) ?? {}}
                    onChange={(values) => setSection(section.id, { ...section.props, values })}
                    kind="landing"
                    errors={sectionErrors(errors, index)}
                    media={allMedia}
                    onMedia={rememberMedia}
                    showEditWithAi={aiEnabled}
                    onEditWithAi={() => {
                      const def = aiDefFor(section);
                      const p = section.props as unknown as AiSectionProps;
                      setDesignerFocus({
                        id: p.ai_section_id,
                        name: def?.name ?? (t.types.ai?.title ?? "قسم بالذكاء الاصطناعي"),
                        values: p.values ?? {},
                      });
                      setDesignerOpen(true);
                    }}
                  />
                ) : (
                  <theme.SectionForm section={section} errors={sectionErrors(errors, index)} onChange={(props) => setSection(section.id, props)} media={allMedia} onMedia={rememberMedia} offers={data.offers} />
                )
              ) : null}
            </Inspector>
          ) : tab === "sections" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <PanelTitle title={t.rail.sections} hint={t.pageHint} badge={t.sectionsCount(draft.sections.length)} />
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-4">
                <PinnedRow icon={LayoutPanelTop} label={tb.header} onClick={() => select("header")} />
                <SortableList
                  items={draft.sections}
                  getId={(s) => s.id}
                  onReorder={(sections) => change({ ...draft, sections })}
                  render={(s) => {
                    const i = draft.sections.indexOf(s);
                    const hasError = Object.keys(errors).some((k) => k.startsWith(`content.sections.${i}.`));
                    const form = s.type === "order_form";
                    return (
                      <div className="group flex items-center gap-2">
                        <button type="button" onClick={() => select(s.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
                          <span className={cn(!s.visible && "opacity-40")}>
                            <TypeIcon type={s.type} />
                          </span>
                          <span className="flex min-w-0 flex-col leading-tight">
                            <span className={cn("truncate text-sm font-semibold", !s.visible && "text-ink-3")}>{title(s)}</span>
                            <span className="truncate text-xs text-ink-3">{form ? `${typeName(s.type)} · ${t.locked}` : s.visible ? t.types[s.type].title : `${typeName(s.type)} · ${tb.hidden}`}</span>
                          </span>
                        </button>
                        {hasError ? <TriangleAlert className="size-4 shrink-0 text-danger" aria-label={tb.invalid} /> : null}
                        {form ? (
                          <Lock className="size-3.5 shrink-0 text-ink-3" aria-label={t.locked} />
                        ) : (
                          <>
                            <Button size="icon-sm" variant="ghost" className={cn(s.visible && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100")} aria-label={s.visible ? tb.hide : tb.show} onClick={() => toggle(s.id)}>
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
                                  {tb.moveUp}
                                </MenuItem>
                                <MenuItem disabled={i === draft.sections.length - 1} onSelect={() => move(s.id, 1)}>
                                  <ArrowDown />
                                  {tb.moveDown}
                                </MenuItem>
                                <MenuItem disabled={draft.sections.length >= maxSections} onSelect={() => duplicate(s)}>
                                  <Copy />
                                  {tb.duplicate}
                                </MenuItem>
                                <MenuSeparator />
                                <MenuItem destructive onSelect={() => setRemoving(s)}>
                                  <Trash2 />
                                  {tb.remove}
                                </MenuItem>
                              </MenuContent>
                            </Menu>
                          </>
                        )}
                      </div>
                    );
                  }}
                />
                <PinnedRow icon={PanelBottom} label={tb.footer} onClick={() => select("footer")} />
                <button
                  type="button"
                  onClick={() => setGallery(true)}
                  disabled={draft.sections.length >= maxSections}
                  className="mt-1 flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong text-sm font-semibold text-ink-2 transition hover:border-brand hover:bg-brand-soft/40 hover:text-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="size-4" />
                  {tb.addSection}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <PanelTitle title={t.rail.theme} hint={t.themeHint} />
              <ul className="flex flex-col gap-1.5 overflow-y-auto px-3 pb-4">
                {(
                  [
                    ["look", Palette, t.groups.look],
                    ["header", LayoutPanelTop, t.groups.header],
                    ["footer", PanelBottom, t.groups.footer],
                    ["general", Settings2, t.groups.general],
                  ] as Array<[Edit, LucideIcon, { title: string; hint: string }]>
                ).map(([key, Icon, g]) => (
                  <li key={String(key)}>
                    <GroupRow icon={Icon} label={g.title} hint={g.hint} onClick={() => setSelected(key)} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <main className="relative min-w-0 flex-1 overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:18px_18px] p-5">
          <DeviceFrame device={device} host={host}>
            <div ref={frame} className="h-full overflow-y-auto">
              <Page content={draft as unknown as Content} data={pageData} mode="builder" selected={selected === "look" || selected === "general" ? null : selected} onSelect={(target) => select(target)} media={media} tools={tools} />
            </div>
          </DeviceFrame>
        </main>
      </div>

      <Dialog open={gallery} onOpenChange={setGallery}>
        <DialogContent size="md">
          <DialogHeader title={t.galleryTitle} description={t.galleryHint} />
          <DialogBody>
            <ul className="grid gap-2 sm:grid-cols-2">
              {theme.addable.map((type) => (
                <li key={type}>
                  <button type="button" onClick={() => add(type)} className="flex w-full items-start gap-3 rounded-xl border border-border p-3 text-start transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md">
                    <TypeIcon type={type} />
                    <span className="flex flex-col">
                      <span className="font-semibold">{typeName(type)}</span>
                      <span className="text-xs text-ink-3">{t.types[type]?.description}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <MySectionsGalleryBlock
              kind="landing"
              themeKey={initial.theme_key}
              tokens={aiTokens(draft.settings)}
              open={gallery}
              onPickSection={addMySection}
              showAiCard={aiEnabled}
              onOpenAiDesigner={() => {
                setGallery(false);
                setDesignerInsert("after_selected");
                setDesignerFocus(null);
                setDesignerOpen(true);
              }}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
      <DesignerDialog
        open={designerOpen}
        onOpenChange={setDesignerOpen}
        kind="landing"
        themeKey={initial.theme_key}
        landingPageId={detail.id}
        focusSection={designerFocus}
        tokens={aiTokens(draft.settings)}
        data={{
          media: allMedia,
          landingProduct: data.product
            ? {
                name: data.product.name,
                price: data.product.price,
                compare_at_price: data.product.compare_at_price,
                image: data.product.images?.[0]?.urls?.large ?? data.product.images?.[0]?.urls?.medium ?? null,
              }
            : null,
        }}
        canUseImage={Boolean(
          section &&
            ((section.type === "ai" &&
              aiDefFor(section)?.fields.some(
                (f) => f.type === "image" || f.type === "images",
              )) ||
              "media_id" in section.props),
        )}
        onUseImage={handleUseAiImage}
        onApproved={handleAiApproved}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={tb.removeTitle}
        description={removing ? title(removing) : undefined}
        confirmLabel={tb.remove}
        destructive
        onConfirm={() => {
          if (!removing || removing.type === "order_form") return;
          change({ ...draft, sections: draft.sections.filter((s) => s.id !== removing.id) });
          if (selected === removing.id) setSelected(null);
          setRemoving(null);
        }}
      />
    </div>
  );
}
