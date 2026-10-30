import { BeforeAfterBlock, ComparisonBlock, CountdownBlock, SizeChartBlock, StickyCtaBlock, VideoBlock } from "@/themes/shared/sections/blocks";
import type { BeforeAfterProps, ComparisonProps, CountdownProps, SizeChartProps, StickyCtaProps, VideoProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";

/** Conversion sections: shared markup in the Malak look (themes/shared/sections/looks.ts). */
export function MalakVideo(p: SectionProps<VideoProps>) {
  return <VideoBlock {...p} look="malak" />;
}

export function MalakBeforeAfter(p: SectionProps<BeforeAfterProps>) {
  return <BeforeAfterBlock {...p} look="malak" />;
}

export function MalakSizeChart(p: SectionProps<SizeChartProps>) {
  return <SizeChartBlock {...p} look="malak" />;
}

export function MalakComparison(p: SectionProps<ComparisonProps>) {
  return <ComparisonBlock {...p} look="malak" />;
}

export function MalakCountdown(p: SectionProps<CountdownProps>) {
  return <CountdownBlock {...p} look="malak" />;
}

export function MalakStickyCta(p: SectionProps<StickyCtaProps>) {
  return <StickyCtaBlock {...p} look="malak" />;
}
