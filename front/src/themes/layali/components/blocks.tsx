import { BeforeAfterBlock, ComparisonBlock, CountdownBlock, SizeChartBlock, StickyCtaBlock, VideoBlock } from "@/themes/shared/sections/blocks";
import type { BeforeAfterProps, ComparisonProps, CountdownProps, SizeChartProps, StickyCtaProps, VideoProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";

/** Conversion sections: shared markup in the Layali look (themes/shared/sections/looks.ts). */
export function LayaliVideo(p: SectionProps<VideoProps>) {
  return <VideoBlock {...p} look="layali" />;
}

export function LayaliBeforeAfter(p: SectionProps<BeforeAfterProps>) {
  return <BeforeAfterBlock {...p} look="layali" />;
}

export function LayaliSizeChart(p: SectionProps<SizeChartProps>) {
  return <SizeChartBlock {...p} look="layali" />;
}

export function LayaliComparison(p: SectionProps<ComparisonProps>) {
  return <ComparisonBlock {...p} look="layali" />;
}

export function LayaliCountdown(p: SectionProps<CountdownProps>) {
  return <CountdownBlock {...p} look="layali" />;
}

export function LayaliStickyCta(p: SectionProps<StickyCtaProps>) {
  return <StickyCtaBlock {...p} look="layali" />;
}
