import { IconView } from "@/themes/shared/icon-view";
import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import type { FeatureItem, FeaturesProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";
import { mediaOf } from "@/themes/shared/utils";
import { cn } from "@/lib/utils";

const COLS: Record<string, string> = { "2": "sm:grid-cols-2", "3": "sm:grid-cols-2 lg:grid-cols-3", "4": "sm:grid-cols-2 lg:grid-cols-4" };

export function CeliaFeatures({ props, variant, ctx }: SectionProps<FeaturesProps>) {
  const items = (props.items ?? []).filter((item: FeatureItem) => item?.title?.trim() || item?.description?.trim());
  if (items.length === 0) return null;

  const heading =
    props.title || props.subtitle ? (
      <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        {props.title ? <h2 className="t-heading text-3xl font-black uppercase tracking-tight md:text-5xl">{props.title}</h2> : null}
        {props.subtitle ? <p className="max-w-md opacity-75">{props.subtitle}</p> : null}
      </div>
    ) : null;

  if (variant === "icon-list") {
    return (
      <section className="t-inverse px-4 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          {heading}
          <ul data-reveal-stagger className="border-t-[3px]" style={{ borderColor: "var(--c-bg)" }}>
            {items.map((item, i) => {
              const image = mediaOf(ctx, item.image_media_id);
              return (
                <li key={i} className="flex items-start gap-5 border-b-[3px] py-6" style={{ borderColor: "var(--c-bg)" }}>
                  {image ? (
                    <ResponsiveImage image={image} sizes="64px" className="size-14 shrink-0 object-cover" />
                  ) : (
                    <span className="flex size-14 shrink-0 items-center justify-center border-2" style={{ borderColor: "var(--c-bg)" }}>
                      <IconView name={item.icon} className="size-6" />
                    </span>
                  )}
                  <div>
                    <h3 className="t-heading text-xl font-extrabold">{item.title}</h3>
                    {item.description ? <p className="mt-1 opacity-75">{item.description}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section className="t-bg border-t-[3px] t-line px-4 py-12 md:py-16">
      <div className="mx-auto max-w-6xl">
        {heading}
        <ul data-reveal-stagger className={cn("grid gap-5", COLS[props.columns] ?? COLS["3"])}>
          {items.map((item, i) => {
            const image = mediaOf(ctx, item.image_media_id);
            return (
              <li key={i} className="t-hard t-bg flex flex-col gap-3 p-6">
                <div className="flex items-start justify-between gap-3">
                  <span className="t-heading text-6xl font-black leading-none tabular-nums t-primary-text" dir="ltr">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {image ? <ResponsiveImage image={image} sizes="64px" className="size-14 object-cover" /> : <IconView name={item.icon} className="size-7" />}
                </div>
                <h3 className="t-heading text-xl font-extrabold">{item.title}</h3>
                {item.description ? <p className="t-muted leading-relaxed">{item.description}</p> : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
