import { Check, X } from "lucide-react";
import { formatPrice } from "@/lib/price";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";
import { SafeLink } from "@/themes/shared/components/safe-link";
import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import type { BeforeAfterProps, ComparisonProps, CountdownProps, SizeChartProps, SizeRow, StickyCtaProps, VideoProps } from "@/themes/shared/schemas";
import { mediaOf } from "@/themes/shared/utils";
import type { SectionProps } from "@/themes/types";
import { CompareSlider } from "./compare-slider";
import { CountdownTimer } from "./countdown-timer";
import { LOOKS, type LookKey } from "./looks";
import { StickyBar } from "./sticky-bar";
import { VideoPlayer } from "./video-player";
import { parseVideoUrl } from "./video-url";

type BlockProps<P> = SectionProps<P> & { look: LookKey };

function Heading({ title, subtitle, look }: { title?: string; subtitle?: string; look: LookKey }) {
  if (!title && !subtitle) return null;
  const l = LOOKS[look];
  return (
    <div className={l.headingAlign}>
      {title ? <h2 className={l.heading}>{title}</h2> : null}
      {subtitle ? <p className={l.subtitle}>{subtitle}</p> : null}
    </div>
  );
}

function OrderButton({ label, look, className }: { label: string; look: LookKey; className?: string }) {
  return label ? (
    <SafeLink href="#order" className={cn(LOOKS[look].button, className)}>
      {label}
    </SafeLink>
  ) : null;
}

/* ---------- Video ---------- */

export function VideoBlock({ props, variant, ctx, look }: BlockProps<VideoProps>) {
  const source = parseVideoUrl(props.video_url);
  if (!source) return null;
  const l = LOOKS[look];
  const poster = mediaOf(ctx, props.poster_media_id);
  const player = <VideoPlayer source={source} poster={poster?.urls.large ?? null} title={props.title || siteMessages.blocks.playVideo} className={l.frame} />;

  if (variant === "video-split") {
    return (
      <section className={l.section}>
        <div className={cn(l.container, "grid items-center gap-10 md:grid-cols-[1fr_1.3fr]")}>
          <div className="flex flex-col items-start gap-5">
            <div>
              {props.title ? <h2 className={l.heading}>{props.title}</h2> : null}
              {props.subtitle ? <p className={l.subtitle}>{props.subtitle}</p> : null}
            </div>
            <OrderButton label={props.cta_label} look={look} />
          </div>
          {player}
        </div>
      </section>
    );
  }

  return (
    <section className={l.section}>
      <div className={cn(l.container, "max-w-4xl")}>
        <Heading title={props.title} subtitle={props.subtitle} look={look} />
        {player}
        {props.cta_label ? (
          <div className="mt-8 flex justify-center">
            <OrderButton label={props.cta_label} look={look} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- Before / after ---------- */

export function BeforeAfterBlock({ props, variant, ctx, look }: BlockProps<BeforeAfterProps>) {
  const before = mediaOf(ctx, props.before_media_id);
  const after = mediaOf(ctx, props.after_media_id);
  if (!before || !after) return null;
  const l = LOOKS[look];
  const beforeLabel = props.before_label || siteMessages.blocks.before;
  const afterLabel = props.after_label || siteMessages.blocks.after;

  if (variant === "two-images") {
    return (
      <section className={l.section}>
        <div className={l.container}>
          <Heading title={props.title} subtitle={props.subtitle} look={look} />
          <div className="grid grid-cols-2 gap-3 md:gap-6">
            {[
              [before, beforeLabel],
              [after, afterLabel],
            ].map(([image, label], i) => (
              <figure key={i} className={cn("relative", l.frame)}>
                <ResponsiveImage image={image as NonNullable<typeof before>} sizes="(min-width: 768px) 40vw, 50vw" className="aspect-[3/4] w-full object-cover" />
                <figcaption className={cn("absolute start-3 top-3", l.chip)}>{label as string}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={l.section}>
      <div className={cn(l.container, "max-w-3xl")}>
        <Heading title={props.title} subtitle={props.subtitle} look={look} />
        <CompareSlider
          before={{ src: before.urls.large, alt: before.alt ?? beforeLabel }}
          after={{ src: after.urls.large, alt: after.alt ?? afterLabel }}
          beforeLabel={beforeLabel}
          afterLabel={afterLabel}
          chipClassName={l.chip}
          className={l.frame}
        />
      </div>
    </section>
  );
}

/* ---------- Size chart ---------- */

export function SizeChartBlock({ props, variant, look }: BlockProps<SizeChartProps>) {
  const rows = (props.rows ?? []).filter((row: SizeRow) => row?.size?.trim());
  if (rows.length === 0) return null;
  const l = LOOKS[look];
  const columns = (["col1", "col2", "col3"] as const).filter((key) => props[`${key}_label`]?.trim() || rows.some((row) => row[key]?.trim()));
  const labelOf = (key: (typeof columns)[number]) => props[`${key}_label`] ?? "";

  if (variant === "size-cards") {
    return (
      <section className={l.section}>
        <div className={l.container}>
          <Heading title={props.title} look={look} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((row, i) => (
              <div key={i} className={cn("p-4", l.card)}>
                <p className="t-heading t-primary-text text-2xl font-black" dir="ltr">
                  {row.size}
                </p>
                <dl className="mt-3 flex flex-col gap-1.5 text-sm">
                  {columns.map((key) =>
                    row[key]?.trim() ? (
                      <div key={key} className="flex justify-between gap-2">
                        <dt className="t-muted">{labelOf(key)}</dt>
                        <dd className="font-semibold tabular-nums">{row[key]}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              </div>
            ))}
          </div>
          {props.note ? <p className="t-muted mt-5 text-sm">{props.note}</p> : null}
        </div>
      </section>
    );
  }

  return (
    <section className={l.section}>
      <div className={cn(l.container, "max-w-3xl")}>
        <Heading title={props.title} look={look} />
        <div className={cn("overflow-x-auto", l.card)}>
          <table className="w-full min-w-[22rem] text-center text-sm md:text-base">
            <thead>
              <tr className={l.tableHead}>
                <th scope="col" className="px-4 py-3">
                  {props.size_label}
                </th>
                {columns.map((key) => (
                  <th key={key} scope="col" className="px-4 py-3">
                    {labelOf(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={l.rowLine}>
                  <th scope="row" className="t-primary-text px-4 py-3 font-black" dir="ltr">
                    {row.size}
                  </th>
                  {columns.map((key) => (
                    <td key={key} className="px-4 py-3 tabular-nums">
                      {row[key] || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {props.note ? <p className="t-muted mt-4 text-center text-sm">{props.note}</p> : null}
      </div>
    </section>
  );
}

/* ---------- Comparison ---------- */

function Mark({ on }: { on: boolean }) {
  return on ? (
    <span className="t-primary inline-flex size-7 items-center justify-center rounded-full">
      <Check className="size-4" strokeWidth={3} aria-hidden />
      <span className="sr-only">{siteMessages.blocks.yes}</span>
    </span>
  ) : (
    <span className="t-tint-strong t-muted inline-flex size-7 items-center justify-center rounded-full">
      <X className="size-4" strokeWidth={3} aria-hidden />
      <span className="sr-only">{siteMessages.blocks.no}</span>
    </span>
  );
}

export function ComparisonBlock({ props, variant, look }: BlockProps<ComparisonProps>) {
  const rows = (props.rows ?? []).filter((row) => row?.feature?.trim());
  if (rows.length === 0) return null;
  const l = LOOKS[look];

  if (variant === "versus-cards") {
    const side = (label: string, key: "us" | "them", highlight: boolean) => (
      <div className={cn("flex flex-col gap-4 p-6", highlight ? l.card : l.tint, highlight && "md:-translate-y-2")}>
        <p className={cn("t-heading text-xl font-black", highlight && "t-primary-text")}>{label}</p>
        <ul className="flex flex-col gap-3">
          {rows.map((row, i) => (
            <li key={i} className={cn("flex items-center gap-3", !row[key] && "t-muted line-through decoration-1")}>
              <Mark on={row[key]} />
              <span>{row.feature}</span>
            </li>
          ))}
        </ul>
      </div>
    );
    return (
      <section className={l.section}>
        <div className={cn(l.container, "max-w-4xl")}>
          <Heading title={props.title} subtitle={props.subtitle} look={look} />
          <div className="grid gap-5 md:grid-cols-2">
            {side(props.us_label, "us", true)}
            {side(props.them_label, "them", false)}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={l.section}>
      <div className={cn(l.container, "max-w-3xl")}>
        <Heading title={props.title} subtitle={props.subtitle} look={look} />
        <div className={cn("overflow-hidden", l.card)}>
          <table className="w-full text-sm md:text-base">
            <thead>
              <tr className={l.tableHead}>
                <th scope="col" className="px-4 py-3 text-start">
                  <span className="sr-only">{props.title}</span>
                </th>
                <th scope="col" className="w-[4.5rem] px-1 py-3 text-center text-xs md:w-36 md:px-2 md:text-base">
                  {props.us_label}
                </th>
                <th scope="col" className="w-[4.5rem] px-1 py-3 text-center text-xs md:w-36 md:px-2 md:text-base">
                  {props.them_label}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={l.rowLine}>
                  <th scope="row" className="px-4 py-3.5 text-start font-semibold">
                    {row.feature}
                  </th>
                  <td className="px-2 py-3.5 text-center">
                    <Mark on={row.us} />
                  </td>
                  <td className="px-2 py-3.5 text-center">
                    <Mark on={row.them} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ---------- Countdown ---------- */

export function CountdownBlock({ props, variant, sectionId, look }: BlockProps<CountdownProps>) {
  const l = LOOKS[look];
  const mode = props.mode === "fixed" ? "fixed" : "evergreen";
  if (mode === "fixed" && !props.ends_at) return null;
  const expired = <p className="t-muted text-lg font-semibold">{props.expired_text || siteMessages.blocks.offerEnded}</p>;
  const timer = (
    <CountdownTimer sectionId={sectionId} mode={mode} endsAt={props.ends_at} minutes={props.minutes} expired={expired} boxClassName={cn("min-w-16 py-3 md:min-w-20", l.digit)} labelClassName="t-muted mt-1 text-xs" className="justify-center gap-2 md:gap-3" />
  );

  if (variant === "banner") {
    return (
      <section className="t-primary px-4 py-8 md:py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 text-center md:flex-row md:justify-between md:text-start">
          <div>
            {props.title ? <h2 className="t-heading text-2xl font-black md:text-3xl">{props.title}</h2> : null}
            {props.subtitle ? <p className="mt-1 opacity-85">{props.subtitle}</p> : null}
          </div>
          <div className="flex flex-col items-center gap-4 md:flex-row">
            {timer}
            {props.show_cta && props.cta_label ? (
              <SafeLink href="#order" className="t-btn inline-flex min-h-12 items-center justify-center bg-[var(--c-bg)] px-6 font-bold text-[var(--c-fg)] transition-transform hover:-translate-y-0.5">
                {props.cta_label}
              </SafeLink>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={l.section}>
      <div className={cn(l.container, "flex max-w-3xl flex-col items-center gap-7 p-8 text-center md:p-12", l.tint)}>
        <div>
          {props.title ? <h2 className={l.heading}>{props.title}</h2> : null}
          {props.subtitle ? <p className={l.subtitle}>{props.subtitle}</p> : null}
        </div>
        {timer}
        {props.show_cta ? <OrderButton label={props.cta_label || siteMessages.blocks.orderNow} look={look} /> : null}
      </div>
    </section>
  );
}

/* ---------- Sticky order button ---------- */

export function StickyCtaBlock({ props, variant, ctx, look }: BlockProps<StickyCtaProps>) {
  const l = LOOKS[look];
  const price = props.show_price && ctx.product ? ctx.product.price : null;
  const label = props.cta_label || siteMessages.blocks.orderNow;

  if (variant === "pill") {
    return (
      <StickyBar alwaysVisible={ctx.isPreview} desktop={props.show_on_desktop} className="flex justify-center">
        <SafeLink href="#order" className={cn(l.button, "w-full max-w-md justify-between rounded-full px-6")}>
          <span>{label}</span>
          {price !== null ? <span className="tabular-nums opacity-90">{formatPrice(price)}</span> : null}
        </SafeLink>
      </StickyBar>
    );
  }

  return (
    <StickyBar alwaysVisible={ctx.isPreview} desktop={props.show_on_desktop} className={cn("px-0 pt-0 pb-0", l.bar)}>
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {price !== null ? (
          <div className="flex shrink-0 flex-col leading-tight">
            {ctx.product?.compare_at_price ? <span className="t-muted text-xs line-through tabular-nums">{formatPrice(ctx.product.compare_at_price)}</span> : null}
            <span className="t-heading text-lg font-black tabular-nums">{formatPrice(price)}</span>
          </div>
        ) : null}
        <SafeLink href="#order" className={cn(l.button, "min-h-12 flex-1 px-4 text-base")}>
          {label}
        </SafeLink>
      </div>
    </StickyBar>
  );
}
