import { beforeEach, describe, expect, it } from "vitest";
import { SCHEMAS } from "@/themes/shared/schemas";
import { anchorFor } from "./anchors";
import { createBuilderStore, MAX_SECTIONS, starterContent, type BuilderStore } from "./store";

let store: BuilderStore;
const types = () => store.getState().content.sections.map((s) => s.type);

beforeEach(() => {
  store = createBuilderStore();
  store.getState().init({
    page: { id: 1, title: "t", slug: "s", status: "draft", identity_id: 1, product_id: null },
    content: { version: 1, sections: [] },
    themeKey: "malak",
    version: 3,
  });
});

describe("builder store", () => {
  it("adds sections with schema defaults and the theme default variant", () => {
    const id = store.getState().addSection("hero");
    const section = store.getState().content.sections[0];

    expect(section.id).toBe(id);
    expect(section.variant).toBe("split");
    expect(section.props).toEqual(SCHEMAS.hero.defaults);
    expect(section.props).not.toBe(SCHEMAS.hero.defaults);
    expect(store.getState().selectedId).toBe(id);
    expect(store.getState().saveState).toBe("unsaved");
  });

  it("keeps the header first and the footer last", () => {
    const s = store.getState();
    s.addSection("faq");
    s.addSection("footer");
    s.addSection("hero");
    s.addSection("header");

    expect(types()).toEqual(["header", "faq", "hero", "footer"]);

    s.addSection("features", 0);
    expect(types()[0]).toBe("header");
    expect(types().at(-1)).toBe("footer");
  });

  it("does not allow a second header, footer or order form", () => {
    const s = store.getState();
    expect(s.addSection("header")).not.toBeNull();
    expect(s.addSection("header")).toBeNull();
    expect(s.addSection("order_form")).not.toBeNull();
    expect(s.addSection("order_form")).toBeNull();
    s.addSection("footer");
    expect(s.addSection("footer")).toBeNull();
    expect(types().filter((t) => t === "header")).toHaveLength(1);
  });

  it("caps the page at 30 sections", () => {
    const s = store.getState();
    for (let i = 0; i < 40; i++) {
      s.addSection(i % 2 ? "features" : "hero");
      s.addSection("faq");
      s.addSection("gallery");
      s.addSection("testimonials");
      s.addSection("offers");
      s.addSection("product_showcase");
    }
    expect(store.getState().content.sections.length).toBeLessThanOrEqual(MAX_SECTIONS);
  });

  it("moves sections but never past the pinned ones", () => {
    const s = store.getState();
    s.addSection("header");
    s.addSection("hero");
    s.addSection("faq");
    s.addSection("footer");

    s.moveSection(2, 1);
    expect(types()).toEqual(["header", "faq", "hero", "footer"]);

    s.moveSection(1, 0); // trying to go above the header
    expect(types()).toEqual(["header", "faq", "hero", "footer"]);

    s.moveSection(0, 2); // the header itself cannot move
    expect(types()).toEqual(["header", "faq", "hero", "footer"]);
  });

  it("duplicates, hides, edits and removes", () => {
    const s = store.getState();
    const id = s.addSection("faq")!;
    const copyId = store.getState().duplicateSection(id)!;
    expect(store.getState().content.sections.map((x) => x.id)).toEqual([id, copyId]);

    store.getState().toggleVisible(id);
    expect(store.getState().content.sections[0].visible).toBe(false);

    store.getState().updateProps(copyId, { title: "جديد" });
    expect(store.getState().content.sections[1].props.title).toBe("جديد");
    expect(store.getState().content.sections[0].props.title).not.toBe("جديد");

    store.getState().setVariant(copyId, "two-columns");
    expect(store.getState().content.sections[1].variant).toBe("two-columns");

    store.getState().select(copyId);
    store.getState().removeSection(copyId);
    expect(store.getState().content.sections).toHaveLength(1);
    expect(store.getState().selectedId).toBeNull();
  });

  it("does not duplicate singletons", () => {
    const id = store.getState().addSection("header")!;
    expect(store.getState().duplicateSection(id)).toBeNull();
  });

  it("undoes and redoes", () => {
    const s = store.getState();
    s.addSection("hero");
    s.addSection("faq");
    expect(types()).toEqual(["hero", "faq"]);

    store.getState().undo();
    expect(types()).toEqual(["hero"]);
    store.getState().undo();
    expect(types()).toEqual([]);
    store.getState().undo();
    expect(types()).toEqual([]);

    store.getState().redo();
    store.getState().redo();
    expect(types()).toEqual(["hero", "faq"]);

    store.getState().undo();
    store.getState().addSection("gallery");
    store.getState().redo(); // future is cleared by a new edit
    expect(types()).toEqual(["hero", "gallery"]);
  });

  it("switches theme mapping unknown variants to the new default and back is undoable", () => {
    const s = store.getState();
    s.addSection("hero");
    s.setVariant(store.getState().content.sections[0].id, "centered-card");
    s.addSection("faq");

    store.getState().setTheme("celia");
    expect(store.getState().themeKey).toBe("celia");
    expect(store.getState().content.sections.map((x) => x.variant)).toEqual(["big-type", "accordion-lines"]);
    expect(store.getState().content.sections[0].props).toEqual(SCHEMAS.hero.defaults);

    store.getState().undo();
    expect(store.getState().themeKey).toBe("malak");
    expect(store.getState().content.sections[0].variant).toBe("centered-card");
  });

  it("keeps a variant that exists in both themes", () => {
    store.getState().addSection("hero");
    store.getState().setVariant(store.getState().content.sections[0].id, "full-cover");
    store.getState().setTheme("celia");
    expect(store.getState().content.sections[0].variant).toBe("full-cover");
  });

  it("tracks save state including edits made during a save", () => {
    const s = store.getState();
    s.addSection("hero");
    const sent = store.getState().content;
    store.getState().markSaving();
    expect(store.getState().saveState).toBe("saving");

    store.getState().markSaved(4, sent);
    expect(store.getState()).toMatchObject({ saveState: "saved", dirty: false, version: 4 });

    const sent2 = store.getState().content;
    store.getState().markSaving();
    store.getState().addSection("faq");
    store.getState().markSaved(5, sent2);
    expect(store.getState()).toMatchObject({ saveState: "unsaved", dirty: true, version: 5 });
  });
});

describe("starter content", () => {
  it("builds the 10 starter sections of each theme", () => {
    for (const theme of ["malak", "celia"]) {
      const content = starterContent(theme);
      expect(content.sections.map((s) => s.type)).toEqual(["header", "hero", "gallery", "product_showcase", "features", "offers", "testimonials", "faq", "order_form", "footer"]);
      expect(new Set(content.sections.map((s) => s.id)).size).toBe(10);
    }
  });
});

describe("anchors", () => {
  it("uses #order for the order form and section-<8 chars> otherwise", () => {
    expect(anchorFor({ id: "1a2b3c4d-1111-4222-8333-444455556666", type: "faq" })).toBe("section-1a2b3c4d");
    expect(anchorFor({ id: "1a2b3c4d-1111-4222-8333-444455556666", type: "order_form" })).toBe("order");
  });
});

describe("page design", () => {
  const design = {
    colors: { primary: "#0F766E", secondary: "#E6F4F1", accent: "#F59E0B", background: "#FFFFFF", foreground: "#0F1F1C", muted: "#5B6B67", border: "#D9E7E3" },
    font_heading: "readex_pro",
    font_body: "tajawal",
    button_radius: "full" as const,
  };

  it("sets, undoes and clears a page-only design, and keeps it on reload", () => {
    const { setDesign } = store.getState();
    setDesign(design);
    expect(store.getState().content.design).toEqual(design);
    expect(store.getState().dirty).toBe(true);

    store.getState().undo();
    expect(store.getState().content.design).toBeUndefined();
    store.getState().redo();
    expect(store.getState().content.design?.font_body).toBe("tajawal");

    setDesign(null);
    expect("design" in store.getState().content).toBe(false);

    store.getState().replaceFromServer({ content: { version: 1, sections: [], design }, themeKey: "malak", version: 3 });
    expect(store.getState().content.design).toEqual(design);
  });
});
