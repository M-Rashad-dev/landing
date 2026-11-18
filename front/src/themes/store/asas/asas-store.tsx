"use client";

import * as React from "react";
import type { StoreConfig } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { Footer, Header, WhatsappButton } from "./chrome";
import { StoreAiSection } from "@/themes/store/shared/ai-section";
import type { ThemeMode } from "@/themes/store/shared/context";
import { AsasRoot } from "./root";
import { Banner, Features, ProductList, Testimonials } from "./sections";
import type { DesignData } from "@/themes/store/shared/types";
import type { Design, Section } from "./types";

export type Selection = string | "header" | "footer" | null;

/**
 * The store home of «أساس» in one piece: header, the visible sections in order, footer. The
 * Builder and its preview draw it (sections selectable in the Builder); the live store draws the
 * same sections inside its page frame (HomeSections).
 */
export function AsasStore({
  design,
  data,
  storeName,
  mode = "live",
  selected = null,
  onSelect,
  media = {},
  tools,
}: {
  design: Design;
  data: DesignData;
  storeName: string;
  mode?: ThemeMode;
  selected?: Selection;
  onSelect?: (id: Selection) => void;
  media?: DesignData["media"];
  /** Builder: quick actions drawn over the selected part (move, copy, hide, delete). */
  tools?: (id: Selection) => React.ReactNode;
}) {
  const select = (id: Selection) => (event: React.MouseEvent) => {
    if (mode !== "builder" || !onSelect) return;
    // The quick actions over the selection handle their own clicks.
    if ((event.target as HTMLElement).closest("[data-builder-tools]")) return;
    // A click on the preview selects; it never follows a link of the store.
    event.preventDefault();
    event.stopPropagation();
    onSelect(id);
  };
  const frame = (id: Selection) => (mode === "builder" ? cn("as-selectable", selected === id && "as-selected") : undefined);
  const toolsOf = (id: Selection) => (mode === "builder" && tools && selected === id ? <div data-builder-tools className="absolute end-3 top-3 z-20">{tools(id)}</div> : null);

  return (
    <AsasRoot settings={design.settings} data={data} storeName={storeName} mode={mode} media={media} className="min-h-full">
      <div className={frame("header")} onClickCapture={mode === "builder" ? select("header") : undefined}>
        <Header />
        {toolsOf("header")}
      </div>
      <main>
        {design.sections
          .filter((section) => section.visible)
          .map((section) => (
            <div key={section.id} id={`section-${section.id}`} className={frame(section.id)} onClickCapture={mode === "builder" ? select(section.id) : undefined}>
              <SectionView section={section} />
              {toolsOf(section.id)}
            </div>
          ))}
      </main>
      <div className={frame("footer")} onClickCapture={mode === "builder" ? select("footer") : undefined}>
        <Footer />
        {toolsOf("footer")}
      </div>
      <WhatsappButton />
    </AsasRoot>
  );
}

/** The frame of every live «أساس» page: header, the page, footer, the WhatsApp button. */
export function AsasFrame({ config, children }: { config: StoreConfig; children: React.ReactNode }) {
  return (
    <AsasRoot settings={config.design.settings} data={config.data} storeName={config.store_name} mode="live" className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsappButton />
    </AsasRoot>
  );
}

/** The home sections of the live store (the page frame around them comes from the store layout). */
export function HomeSections({ sections }: { sections: Section[] }) {
  return (
    <>
      {sections
        .filter((section) => section.visible)
        .map((section) => (
          <div key={section.id} id={`section-${section.id}`}>
            <SectionView section={section} />
          </div>
        ))}
    </>
  );
}

function SectionView({ section }: { section: Section }) {
  switch (section.type) {
    case "banner":
      return <Banner id={section.id} props={section.props} />;
    case "products":
      return <ProductList id={section.id} props={section.props} />;
    case "features":
      return <Features props={section.props} />;
    case "testimonials":
      return <Testimonials props={section.props} />;
    case "ai":
      return <StoreAiSection section={section} themeKey="asas_store" />;
  }
}
