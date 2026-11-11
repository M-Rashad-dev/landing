"use client";

import { PageHeader } from "@/components/layout/page-header";
import { ar } from "@/messages/ar";
import { BadgesSection, ButtonsSection } from "./sections/buttons";
import { DetailsSection } from "./sections/details";
import { FeedbackSection } from "./sections/feedback";
import { FormsSection } from "./sections/forms";
import { FoundationsSection } from "./sections/foundations";
import { InputsSection } from "./sections/inputs";
import { NavigationSection } from "./sections/navigation";
import { OverlaysSection } from "./sections/overlays";
import { LayoutSection, PlatformSection } from "./sections/platform";
import { ChartsSection, StatsSection } from "./sections/stats-charts";
import { TableSection } from "./sections/table";

const ORDER = ["foundations", "buttons", "badges", "inputs", "forms", "stats", "charts", "table", "details", "navigation", "overlays", "feedback", "layout", "platform"] as const;

/** /dashboard/components — the living catalog every screen is built from. */
export function ShowcasePage() {
  return (
    <>
      <PageHeader title={ar.showcase.title} description={ar.showcase.description} />
      <nav aria-label={ar.showcase.jump} className="sticky top-16 z-20 -mx-4 mb-8 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <ul className="flex gap-1.5 overflow-x-auto">
          {ORDER.map((id) => (
            <li key={id}>
              <a href={`#${id}`} className="inline-flex h-8 items-center whitespace-nowrap rounded-md border border-border bg-surface px-3 text-[13px] text-ink-2 transition-colors hover:border-border-strong hover:text-ink">
                {ar.showcase.sections[id].title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex flex-col gap-10 pb-24">
        <FoundationsSection />
        <ButtonsSection />
        <BadgesSection />
        <InputsSection />
        <FormsSection />
        <StatsSection />
        <ChartsSection />
        <TableSection />
        <DetailsSection />
        <NavigationSection />
        <OverlaysSection />
        <FeedbackSection />
        <LayoutSection />
        <PlatformSection />
      </div>
    </>
  );
}
