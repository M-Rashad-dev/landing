"use client";

import * as React from "react";
import type { StoreConfig } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import type { Selection } from "../asas/asas-store";
import type { ThemeMode } from "../shared/context";
import type { DesignData } from "../shared/types";
import { BottomNav, Floaters, Footer, Header } from "./chrome";
import { TeknoRoot } from "./root";
import { SectionView } from "./sections";
import type { TeknoDesign, TeknoSection } from "./types";

/** The «تيكنو» home in one piece (Builder, its preview, the showcase): header, the visible sections, footer, the phone's bottom bar. */
export function TeknoStore({
  design,
  data,
  storeName,
  mode = "live",
  selected = null,
  onSelect,
  media = {},
  tools,
}: {
  design: TeknoDesign;
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
    <TeknoRoot settings={design.settings} data={data} storeName={storeName} mode={mode} media={media} className="min-h-full">
      <div className={cn(frame("header"), design.settings.header.sticky && "sticky top-0 z-40")} onClickCapture={mode === "builder" ? select("header") : undefined}>
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
      <BottomNav />
      <Floaters />
    </TeknoRoot>
  );
}

/** The home sections of the live store (the frame comes from the store layout). */
export function TeknoHomeSections({ sections }: { sections: TeknoSection[] }) {
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

/** The frame of every live «تيكنو» page: header, the page, footer, the phone's bottom bar, the WhatsApp button. */
export function TeknoFrame({ config, children }: { config: StoreConfig; children: React.ReactNode }) {
  const design = config.design as unknown as TeknoDesign;
  return (
    <TeknoRoot settings={design.settings} data={config.data} storeName={config.store_name} mode="live" className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <BottomNav />
      <Floaters />
    </TeknoRoot>
  );
}
