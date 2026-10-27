import { createStore, type StoreApi } from "zustand/vanilla";
import { getTheme, resolveVariant } from "@/themes/registry";
import { defaultProps, SCHEMAS } from "@/themes/shared/schemas";
import type { ComponentType, PageContent, PageDesign, Section } from "@/themes/types";

export const MAX_SECTIONS = 30;
const HISTORY_LIMIT = 50;

export type SaveState = "saved" | "saving" | "unsaved" | "error";

export type BuilderPageMeta = {
  id: number;
  title: string;
  slug: string;
  status: "draft" | "published";
  identity_id: number;
  product_id: number | null;
};

type Snapshot = { content: PageContent; themeKey: string };

export type BuilderState = {
  page: BuilderPageMeta | null;
  content: PageContent;
  themeKey: string;
  version: number;
  selectedId: string | null;
  history: Snapshot[];
  future: Snapshot[];
  dirty: boolean;
  saveState: SaveState;
};

export type BuilderActions = {
  init: (input: { page: BuilderPageMeta; content: PageContent; themeKey: string; version: number }) => void;
  addSection: (type: ComponentType, index?: number) => string | null;
  moveSection: (from: number, to: number) => void;
  duplicateSection: (id: string) => string | null;
  removeSection: (id: string) => void;
  toggleVisible: (id: string) => void;
  updateProps: (id: string, patch: Record<string, unknown>) => void;
  setVariant: (id: string, variant: string) => void;
  setTheme: (themeKey: string) => void;
  /** Page-only identity look (null = use the page identity as is). Undoable like any edit. */
  setDesign: (design: PageDesign | null) => void;
  select: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  setPageMeta: (patch: Partial<BuilderPageMeta>) => void;
  markSaving: () => void;
  markSaved: (version: number, savedContent: PageContent) => void;
  markError: () => void;
  /** Replace with server state (after reload / conflict). */
  replaceFromServer: (input: { content: PageContent; themeKey: string; version: number }) => void;
};

export type BuilderStore = StoreApi<BuilderState & BuilderActions>;

const emptyContent = (): PageContent => ({ version: 1, sections: [] });

/** Server content → store content (pinned sections fixed, page design kept). */
function normalize(content: PageContent): PageContent {
  return { version: 1, sections: enforcePinned(content.sections ?? []), ...(content.design ? { design: content.design } : {}) };
}

function newId(): string {
  return crypto.randomUUID();
}

/** Can another section of this type be added? */
export function canAdd(sections: Section[], type: ComponentType): boolean {
  if (sections.length >= MAX_SECTIONS) return false;
  const count = sections.filter((s) => s.type === type).length;
  return count < SCHEMAS[type].limits.max;
}

/** Keep the header first and the footer last whatever the edit. */
export function enforcePinned(sections: Section[]): Section[] {
  const header = sections.filter((s) => SCHEMAS[s.type].limits.pinned === "top");
  const footer = sections.filter((s) => SCHEMAS[s.type].limits.pinned === "bottom");
  const middle = sections.filter((s) => !SCHEMAS[s.type].limits.pinned);
  return [...header, ...middle, ...footer];
}

export function createSection(type: ComponentType, themeKey: string): Section {
  const theme = getTheme(themeKey);
  return {
    id: newId(),
    type,
    variant: theme.components[type].defaultVariant,
    visible: true,
    props: defaultProps(type),
  };
}

/** Sections for a brand-new page in a theme (starter list + schema defaults). */
export function starterContent(themeKey: string): PageContent {
  const theme = getTheme(themeKey);
  return {
    version: 1,
    sections: theme.starterSections.map(({ type, variant }) => ({ ...createSection(type, themeKey), variant })),
  };
}

export function createBuilderStore(): BuilderStore {
  return createStore<BuilderState & BuilderActions>()((set, get) => {
    /** Apply a content change with undo history and "unsaved" state. */
    const commit = (next: PageContent, themeKey = get().themeKey) => {
      const { content, themeKey: currentTheme, history } = get();
      set({
        content: next,
        themeKey,
        history: [...history, { content, themeKey: currentTheme }].slice(-HISTORY_LIMIT),
        future: [],
        dirty: true,
        saveState: "unsaved",
      });
    };

    const mapSection = (id: string, fn: (s: Section) => Section) => {
      const { content } = get();
      if (!content.sections.some((s) => s.id === id)) return;
      commit({ ...content, sections: content.sections.map((s) => (s.id === id ? fn(s) : s)) });
    };

    return {
      page: null,
      content: emptyContent(),
      themeKey: "malak",
      version: 1,
      selectedId: null,
      history: [],
      future: [],
      dirty: false,
      saveState: "saved",

      init: ({ page, content, themeKey, version }) =>
        set({
          page,
          content: normalize(content),
          themeKey,
          version,
          selectedId: null,
          history: [],
          future: [],
          dirty: false,
          saveState: "saved",
        }),

      addSection: (type, index) => {
        const { content, themeKey } = get();
        if (!canAdd(content.sections, type)) return null;
        const section = createSection(type, themeKey);
        const sections = [...content.sections];
        const pinned = SCHEMAS[type].limits.pinned;
        if (pinned === "top") sections.unshift(section);
        else if (pinned === "bottom") sections.push(section);
        else {
          const footerIndex = sections.findIndex((s) => SCHEMAS[s.type].limits.pinned === "bottom");
          const lastAllowed = footerIndex === -1 ? sections.length : footerIndex;
          const headerCount = sections.filter((s) => SCHEMAS[s.type].limits.pinned === "top").length;
          const at = index === undefined ? lastAllowed : Math.min(Math.max(index, headerCount), lastAllowed);
          sections.splice(at, 0, section);
        }
        commit({ ...content, sections: enforcePinned(sections) });
        set({ selectedId: section.id });
        return section.id;
      },

      moveSection: (from, to) => {
        const { content } = get();
        const sections = [...content.sections];
        if (from < 0 || from >= sections.length || to < 0 || to >= sections.length || from === to) return;
        if (SCHEMAS[sections[from].type].limits.pinned) return;
        const [moved] = sections.splice(from, 1);
        sections.splice(to, 0, moved);
        const pinnedSafe = enforcePinned(sections);
        if (pinnedSafe.every((s, i) => s.id === content.sections[i]?.id)) return;
        commit({ ...content, sections: pinnedSafe });
      },

      duplicateSection: (id) => {
        const { content } = get();
        const index = content.sections.findIndex((s) => s.id === id);
        if (index === -1) return null;
        const source = content.sections[index];
        if (!canAdd(content.sections, source.type)) return null;
        const copy: Section = { ...structuredClone(source), id: newId() };
        const sections = [...content.sections];
        sections.splice(index + 1, 0, copy);
        commit({ ...content, sections: enforcePinned(sections) });
        set({ selectedId: copy.id });
        return copy.id;
      },

      removeSection: (id) => {
        const { content, selectedId } = get();
        if (!content.sections.some((s) => s.id === id)) return;
        commit({ ...content, sections: content.sections.filter((s) => s.id !== id) });
        if (selectedId === id) set({ selectedId: null });
      },

      toggleVisible: (id) => mapSection(id, (s) => ({ ...s, visible: !s.visible })),

      updateProps: (id, patch) => mapSection(id, (s) => ({ ...s, props: { ...s.props, ...patch } })),

      setVariant: (id, variant) => mapSection(id, (s) => ({ ...s, variant })),

      setTheme: (themeKey) => {
        const { content, themeKey: current } = get();
        if (themeKey === current) return;
        commit(
          { ...content, sections: content.sections.map((s) => ({ ...s, variant: resolveVariant(themeKey, s.type, s.variant) })) },
          themeKey,
        );
      },

      setDesign: (design) => {
        const { design: _previous, ...content } = get().content;
        void _previous;
        commit(design ? { ...content, design } : content);
      },

      select: (id) => set({ selectedId: id }),

      undo: () => {
        const { history, future, content, themeKey, selectedId } = get();
        const previous = history.at(-1);
        if (!previous) return;
        set({
          content: previous.content,
          themeKey: previous.themeKey,
          history: history.slice(0, -1),
          future: [{ content, themeKey }, ...future].slice(0, HISTORY_LIMIT),
          dirty: true,
          saveState: "unsaved",
          selectedId: previous.content.sections.some((s) => s.id === selectedId) ? selectedId : null,
        });
      },

      redo: () => {
        const { history, future, content, themeKey, selectedId } = get();
        const next = future[0];
        if (!next) return;
        set({
          content: next.content,
          themeKey: next.themeKey,
          history: [...history, { content, themeKey }].slice(-HISTORY_LIMIT),
          future: future.slice(1),
          dirty: true,
          saveState: "unsaved",
          selectedId: next.content.sections.some((s) => s.id === selectedId) ? selectedId : null,
        });
      },

      setPageMeta: (patch) => {
        const { page } = get();
        if (page) set({ page: { ...page, ...patch } });
      },

      markSaving: () => set({ saveState: "saving" }),

      markSaved: (version, savedContent) => {
        // Edits made while the request was in flight stay "unsaved".
        const stillSame = JSON.stringify(get().content) === JSON.stringify(savedContent);
        set({ version, dirty: !stillSame, saveState: stillSame ? "saved" : "unsaved" });
      },

      markError: () => set({ saveState: "error" }),

      replaceFromServer: ({ content, themeKey, version }) =>
        set({ content: normalize(content), themeKey, version, dirty: false, saveState: "saved", history: [], future: [] }),
    };
  });
}
