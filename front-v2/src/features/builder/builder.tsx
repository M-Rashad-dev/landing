"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Copy, Eye, EyeOff, Laptop, LayoutPanelTop, Loader2, MoreHorizontal, Palette, PanelBottom, Plus, Rocket, Settings2, Smartphone, Trash2, TriangleAlert, CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { SortableList } from "@/components/data/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { ConfirmDialog, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import type { MediaItem } from "@/features/media/api";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { AsasStore, type Selection } from "@/themes/asas/asas-store";
import type { Design, DesignData, MediaUrls, Section, SectionType, Settings } from "@/themes/asas/types";
import { copySection, designKey, newSection, publishDesign, saveDesign, sectionErrors, settingsErrors, useDesign, type DesignPayload } from "./api";
import { BannerForm, FeaturesForm, ProductsForm, TestimonialsForm } from "./section-forms";
import { FooterForm, GeneralForm, HeaderForm, LookForm } from "./theme-forms";

const t = ar.design.builder;
const SECTION_TYPES: SectionType[] = ["banner", "products", "features", "testimonials"];
const MAX_SECTIONS = 20;

type Edit = Selection | "look" | "general";
type Status = "saved" | "dirty" | "saving" | "invalid" | "conflict";

export function Builder() {
  const query = useDesign();
  if (query.isPending) {
    return (
      <div className="flex h-dvh flex-col">
        <Skeleton className="h-14 rounded-none" />
        <div className="flex flex-1 gap-4 p-4">
          <Skeleton className="w-72 rounded-xl" />
          <Skeleton className="flex-1 rounded-xl" />
          <Skeleton className="w-80 rounded-xl" />
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
  const [draft, setDraft] = React.useState<Design>(initial.draft);
  const [data, setData] = React.useState<DesignData>(initial.data);
  const [published, setPublished] = React.useState({ at: initial.published_at, pending: initial.has_unpublished_changes });
  const [media, setMedia] = React.useState<Record<string, MediaUrls>>({});
  const [selected, setSelected] = React.useState<Edit>(initial.draft.sections[0]?.id ?? "look");
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [status, setStatus] = React.useState<Status>("saved");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [publishing, setPublishing] = React.useState(false);
  const [removing, setRemoving] = React.useState<Section | null>(null);
  const version = React.useRef(initial.version);
  const pending = React.useRef<Design | null>(null);
  const saving = React.useRef<Promise<boolean> | null>(null);
  const frame = React.useRef<HTMLDivElement>(null);

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

  const change = (next: Design) => {
    setDraft(next);
    pending.current = next;
    setStatus((s) => (s === "conflict" ? s : "dirty"));
  };
  const setSettings = (settings: Settings) => change({ ...draft, settings });
  const setSection = (id: string, props: Section["props"]) => change({ ...draft, sections: draft.sections.map((s) => (s.id === id ? ({ ...s, props } as Section) : s)) });

  function select(id: Edit) {
    setSelected(id);
    if (id && id !== "look" && id !== "general") {
      const box = frame.current;
      const el = box?.querySelector(id === "header" ? "header" : id === "footer" ? "footer" : `#section-${CSS.escape(id)}`);
      // Scroll the preview only: scrollIntoView would also move the page around it.
      if (box && el) box.scrollTo?.({ top: el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop, behavior: "smooth" });
    }
  }

  function add(type: SectionType) {
    const section = newSection(type);
    change({ ...draft, sections: [...draft.sections, section] });
    setSelected(section.id);
    window.setTimeout(() => select(section.id), 50);
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

  return (
    <div className="flex h-dvh flex-col bg-bg">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
        <Button asChild size="sm" variant="ghost">
          <Link href="/dashboard/design/theme">
            <ArrowRight />
            {t.back}
          </Link>
        </Button>
        <span className="font-semibold">{initial.theme.name}</span>
        <SaveStatus status={status} />
        <div className="mx-auto hidden rounded-lg bg-surface-2 p-0.5 md:flex" role="radiogroup">
          {(["desktop", "mobile"] as const).map((d) => (
            <button key={d} type="button" role="radio" aria-checked={device === d} onClick={() => setDevice(d)} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", device === d ? "bg-surface font-semibold shadow-sm" : "text-ink-3")}>
              {d === "desktop" ? <Laptop className="size-4" /> : <Smartphone className="size-4" />}
              {t[d]}
            </button>
          ))}
        </div>
        <Button asChild size="sm" variant="outline" className="ms-auto md:ms-0">
          <Link href="/dashboard/design/preview" target="_blank" onClick={() => void flush()}>
            <ExternalLink />
            {t.preview}
          </Link>
        </Button>
        <Button size="sm" loading={publishing} disabled={status === "conflict" || status === "invalid" || (!published.pending && status === "saved" && published.at !== null)} onClick={() => void publish()}>
          <Rocket />
          {t.publish}
        </Button>
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
        {/* Sections list */}
        <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-e border-border bg-surface p-3">
          <ListButton icon={Palette} label={ar.design.theme.tabs.look} active={selected === "look"} onClick={() => select("look")} />
          <ListButton icon={Settings2} label={ar.design.theme.tabs.general} active={selected === "general"} onClick={() => select("general")} />
          <p className="mb-1 mt-4 px-1 text-xs font-semibold text-ink-3">{t.tabs.sections}</p>
          <ListButton icon={LayoutPanelTop} label={t.header} active={selected === "header"} onClick={() => select("header")} />
          <div className="my-1">
            <SortableList
              items={draft.sections}
              getId={(s) => s.id}
              onReorder={(sections) => change({ ...draft, sections })}
              render={(s) => {
                const i = draft.sections.indexOf(s);
                const hasError = Object.keys(errors).some((k) => k.startsWith(`draft.sections.${i}.`));
                return (
                  <div className={cn("flex items-center gap-1 rounded-md", selected === s.id && "bg-brand-soft/70")}>
                    <button type="button" onClick={() => select(s.id)} className={cn("min-w-0 flex-1 truncate py-1 text-start text-sm", !s.visible && "text-ink-3 line-through")}>
                      {sectionLabel(s)}
                    </button>
                    {hasError ? <TriangleAlert className="size-4 shrink-0 text-danger" aria-label={t.invalid} /> : null}
                    <Button size="icon-sm" variant="ghost" aria-label={s.visible ? t.hide : t.show} onClick={() => change({ ...draft, sections: draft.sections.map((x) => (x.id === s.id ? { ...x, visible: !x.visible } : x)) })}>
                      {s.visible ? <Eye /> : <EyeOff />}
                    </Button>
                    <Menu>
                      <MenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label={ar.common.actions}>
                          <MoreHorizontal />
                        </Button>
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem
                          disabled={draft.sections.length >= MAX_SECTIONS}
                          onSelect={() => {
                            const copy = copySection(s);
                            const at = draft.sections.indexOf(s) + 1;
                            change({ ...draft, sections: [...draft.sections.slice(0, at), copy, ...draft.sections.slice(at)] });
                            setSelected(copy.id);
                          }}
                        >
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
          </div>
          <ListButton icon={PanelBottom} label={t.footer} active={selected === "footer"} onClick={() => select("footer")} />
          <Menu>
            <MenuTrigger asChild>
              <Button variant="outline" className="mt-3" disabled={draft.sections.length >= MAX_SECTIONS}>
                <Plus />
                {t.addSection}
              </Button>
            </MenuTrigger>
            <MenuContent align="start" className="w-64">
              {SECTION_TYPES.map((type) => (
                <MenuItem key={type} onSelect={() => add(type)} className="flex-col items-start gap-0">
                  <span className="font-semibold">{t.types[type].title}</span>
                  <span className="text-xs text-ink-3">{t.types[type].description}</span>
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
          {draft.sections.length >= MAX_SECTIONS ? <p className="mt-2 text-xs text-ink-3">{t.maxSections}</p> : null}
        </aside>

        {/* Preview */}
        <main className="min-w-0 flex-1 overflow-hidden bg-surface-2 p-4">
          <div ref={frame} className={cn("mx-auto h-full overflow-y-auto rounded-xl border border-border bg-white shadow-sm transition-[width] duration-300", device === "mobile" ? "w-[390px]" : "w-full max-w-[1280px]")}>
            <AsasStore design={draft} data={data} storeName={initial.store_name} mode="builder" selected={selected === "look" || selected === "general" ? null : selected} onSelect={(id) => setSelected(id)} media={media} />
          </div>
        </main>

        {/* Settings of the selection */}
        <aside className="w-80 shrink-0 overflow-y-auto border-s border-border bg-surface p-4">
          <h2 className="mb-4 font-semibold">{editorTitle(selected, section)}</h2>
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
          ) : (
            <p className="text-sm text-ink-3">{t.pickSection}</p>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t.removeTitle}
        description={removing ? sectionLabel(removing) : undefined}
        confirmLabel={t.remove}
        destructive
        onConfirm={() => {
          if (!removing) return;
          change({ ...draft, sections: draft.sections.filter((s) => s.id !== removing.id) });
          if (selected === removing.id) setSelected("look");
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

function sectionLabel(s: Section): string {
  const custom = s.type === "products" ? s.props.title : s.type === "features" || s.type === "testimonials" ? s.props.title : null;
  return custom ? `${t.types[s.type].title}: ${custom}` : t.types[s.type].title;
}

function editorTitle(selected: Edit, section: Section | null): string {
  if (selected === "look") return ar.design.theme.tabs.look;
  if (selected === "general") return ar.design.theme.tabs.general;
  if (selected === "header") return t.header;
  if (selected === "footer") return t.footer;
  return section ? t.types[section.type].title : t.tabs.sections;
}

function ListButton({ icon: Icon, label, active, onClick }: { icon: typeof Palette; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex items-center gap-2 rounded-md px-2 py-2 text-start text-sm", active ? "bg-brand-soft/70 font-semibold text-brand-strong" : "hover:bg-surface-2")}>
      <Icon className="size-4 shrink-0" />
      {label}
    </button>
  );
}

function SaveStatus({ status }: { status: Status }) {
  if (status === "saving" || status === "dirty")
    return (
      <span className="flex items-center gap-1 text-xs text-ink-3">
        <Loader2 className="size-3.5 animate-spin" />
        {status === "saving" ? t.saving : t.unsaved}
      </span>
    );
  if (status === "invalid")
    return (
      <Badge tone="danger" size="sm">
        <TriangleAlert />
        {t.invalid}
      </Badge>
    );
  if (status === "conflict") return null;
  return (
    <span className="flex items-center gap-1 text-xs text-ink-3">
      <CheckCircle2 className="size-3.5 text-success" />
      {t.saved}
    </span>
  );
}
