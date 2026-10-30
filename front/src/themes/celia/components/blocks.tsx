import { BeforeAfterBlock, ComparisonBlock, CountdownBlock, SizeChartBlock, StickyCtaBlock, VideoBlock } from "@/themes/shared/sections/blocks";
import type { BeforeAfterProps, ComparisonProps, CountdownProps, SizeChartProps, StickyCtaProps, VideoProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";

/** Conversion sections: shared markup in the Celia look (themes/shared/sections/looks.ts). */
export function CeliaVideo(p: SectionProps<VideoProps>) {
  return <VideoBlock {...p} look="celia" />;
}

export function CeliaBeforeAfter(p: SectionProps<BeforeAfterProps>) {
  return <BeforeAfterBlock {...p} look="celia" />;
}

export function CeliaSizeChart(p: SectionProps<SizeChartProps>) {
  return <SizeChartBlock {...p} look="celia" />;
}

export function CeliaComparison(p: SectionProps<ComparisonProps>) {
  return <ComparisonBlock {...p} look="celia" />;
}

export function CeliaCountdown(p: SectionProps<CountdownProps>) {
  return <CountdownBlock {...p} look="celia" />;
}

export function CeliaStickyCta(p: SectionProps<StickyCtaProps>) {
  return <StickyCtaBlock {...p} look="celia" />;
}
