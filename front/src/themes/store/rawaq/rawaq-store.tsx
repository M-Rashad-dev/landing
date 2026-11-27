"use client";

import * as React from "react";
import type { StoreConfig } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import type { Selection } from "../asas/asas-store";
import type { ThemeMode } from "../shared/context";
import type { DesignData } from "../shared/types";
import { Floaters, Footer, Header } from "./chrome";
import { RawaqRoot } from "./root";
import { SectionView } from "./sections";
import type { RawaqDesign, RawaqSection } from "./types";

/** The «رواق» home in one piece (Builder, its preview, the showcase): header, the visible sections, footer. */
export function RawaqStore({
  design,
  data,
  storeName,
  mode = "live",
  selected = null,
  onSelect,
  media = {},
  tools,
}: {
  design: RawaqDesign;
  data: DesignData;
  storeName: string;
  mode?: ThemeMode;
  selected?: Selection;
  onSelect?: (id: Selection) => void;
  media?: DesignData["media"];
  tools?: (id: Selection) => React.ReactNode;
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

  return (
    <RawaqRoot settings={design.settings} data={data} storeName={storeName} mode={mode} media={media} className="min-h-full">
      <div className={cn(frame("header"), "sticky top-0 z-40")} onClickCapture={mode === "builder" ? select("header") : undefined}>
        <Header />
        {toolsOf("header")}
      </div>
      <main className="flex-1">
        {design.sections
          .filter((s) => s.visible)
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
      <Floaters />
    </RawaqRoot>
  );
}

/** The home sections of the live store (the frame comes from the store layout). */
export function RawaqHomeSections({ sections }: { sections: RawaqSection[] }) {
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

/** The frame of every live «رواق» page: header, the page, footer, the floating buttons. */
export function RawaqFrame({ config, children }: { config: StoreConfig; children: React.ReactNode }) {
  const design = config.design as unknown as RawaqDesign;
  return (
    <RawaqRoot settings={design.settings} data={config.data} storeName={config.store_name} mode="live" className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <Floaters />
    </RawaqRoot>
  );
}
