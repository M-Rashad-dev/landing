"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import "./asas.css";
import { Footer, Header, WhatsappButton } from "./chrome";
import { ThemeProvider, type ThemeMode } from "./context";
import { Banner, Features, ProductList, Testimonials } from "./sections";
import { FONT_SCALE, FONTS, inkOn, type Design, type DesignData, type Section } from "./types";

export type Selection = string | "header" | "footer" | null;

/**
 * The store home of «أساس»: header, the visible sections in order, footer. The same component
 * renders the live store and the Builder preview (where sections are selectable).
 */
export function AsasStore({
  design,
  data,
  storeName,
  mode = "live",
  selected = null,
  onSelect,
  media = {},
}: {
  design: Design;
  data: DesignData;
  storeName: string;
  mode?: ThemeMode;
  selected?: Selection;
  onSelect?: (id: Selection) => void;
  media?: DesignData["media"];
}) {
  const s = design.settings;
  const font = FONTS[s.font] ?? FONTS.cairo;
  const style = {
    "--as-primary": s.colors.primary,
    "--as-secondary": s.colors.secondary,
    "--as-bg": s.colors.background,
    "--as-text": s.colors.text,
    "--as-on-primary": inkOn(s.colors.primary),
    "--as-on-secondary": inkOn(s.colors.secondary),
    "--as-font": `"${font.family}"`,
    "--as-fs": String(FONT_SCALE[s.font_size] ?? 1),
  } as React.CSSProperties;

  const select = (id: Selection) => (event: React.MouseEvent) => {
    if (mode !== "builder" || !onSelect) return;
    event.stopPropagation();
    onSelect(id);
  };
  const frame = (id: Selection) => (mode === "builder" ? cn("as-selectable", selected === id && "as-selected") : undefined);

  return (
    <ThemeProvider value={{ mode, settings: s, data, storeName, media }}>
      {/* React hoists the font stylesheet into the document head. */}
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${font.google}&display=swap`} precedence="default" />
      <div dir="rtl" lang="ar" data-mode={mode} className="as-root relative min-h-full" style={style}>
        <div className={frame("header")} onClickCapture={mode === "builder" ? select("header") : undefined}>
          <Header />
        </div>
        <main>
          {design.sections
            .filter((section) => section.visible)
            .map((section) => (
              <div key={section.id} id={`section-${section.id}`} className={frame(section.id)} onClickCapture={mode === "builder" ? select(section.id) : undefined}>
                <SectionView section={section} />
              </div>
            ))}
        </main>
        <div className={frame("footer")} onClickCapture={mode === "builder" ? select("footer") : undefined}>
          <Footer />
        </div>
        <WhatsappButton />
      </div>
    </ThemeProvider>
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
  }
}
