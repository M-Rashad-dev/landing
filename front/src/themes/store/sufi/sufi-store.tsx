"use client";

import * as React from "react";
import type { StoreConfig } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "@/themes/store/shared/context";
import type { DesignData } from "@/themes/store/shared/types";
import { Floaters, Footer, Header } from "./chrome";
import { SufiRoot } from "./root";
import { SectionView } from "./sections";
import type { Scheme, SufiDesign, SufiSection } from "./types";

export type Selection = string | "header" | "footer" | null;

/**
 * The «صوفي» home in one piece (Builder and its preview): header, the visible sections, footer.
 * Same contract as AsasStore, plus the scheme the Builder previews.
 */
export function SufiStore({
  design,
  data,
  storeName,
  mode = "live",
  selected = null,
  onSelect,
  media = {},
  tools,
  scheme,
}: {
  design: SufiDesign;
  data: DesignData;
  storeName: string;
  mode?: ThemeMode;
  selected?: Selection;
  onSelect?: (id: Selection) => void;
  media?: DesignData["media"];
  tools?: (id: Selection) => React.ReactNode;
  scheme?: Scheme;
}) {
  const select = (id: Selection) => (event: React.MouseEvent) => {
    if (mode !== "builder" || !onSelect) return;
    if ((event.target as HTMLElement).closest("[data-builder-tools]")) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(id);
  };
  const frame = (id: Selection) => (mode === "builder" ? cn("as-selectable relative", selected === id && "as-selected") : undefined);
  const toolsOf = (id: Selection) => (mode === "builder" && tools && selected === id ? <div data-builder-tools className="absolute end-3 top-3 z-[55]">{tools(id)}</div> : null);
  const sections = design.sections.filter((s) => s.visible);

  return (
    <SufiRoot settings={design.settings} data={data} storeName={storeName} mode={mode} media={media} scheme={scheme} className="min-h-full">
      <div className={cn(frame("header"), "sticky top-0 z-40")} onClickCapture={mode === "builder" ? select("header") : undefined}>
        <Header />
        {toolsOf("header")}
      </div>
      <main className="flex-1">
        {sections.map((section) => (
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
      <Floaters />
    </SufiRoot>
  );
}

/** The home sections of the live store (the frame comes from the store layout). */
export function SufiHomeSections({ sections }: { sections: SufiSection[] }) {
  return (
    <>
      {sections
        .filter((s) => s.visible)
        .map((section) => (
          <div key={section.id} id={`section-${section.id}`}>
            <SectionView section={section} />
          </div>
        ))}
    </>
  );
}

/** The frame of every live «صوفي» page: header, the page, footer, the floating buttons. */
export function SufiFrame({ config, children }: { config: StoreConfig; children: React.ReactNode }) {
  const design = config.design as unknown as SufiDesign;
  return (
    <SufiRoot settings={design.settings} data={config.data} storeName={config.store_name} mode="live" className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <Floaters />
    </SufiRoot>
  );
}
