import { IconView } from "@/themes/shared/icon-view";
import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import type { FeatureItem, FeaturesProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";
import { mediaOf } from "@/themes/shared/utils";
import { cn } from "@/lib/utils";

const COLS: Record<string, string> = { "2": "sm:grid-cols-2", "3": "sm:grid-cols-2 lg:grid-cols-3", "4": "sm:grid-cols-2 lg:grid-cols-4" };

function Heading({ props }: { props: FeaturesProps }) {
  if (!props.title && !props.subtitle) return null;
  return (
    <div className="mx-auto mb-14 max-w-2xl text-center">
      {props.title ? <h2 className="t-heading l-grad-text text-3xl font-bold md:text-4xl">{props.title}</h2> : null}
      {props.subtitle ? <p className="t-muted mt-4 leading-relaxed">{props.subtitle}</p> : null}
    </div>
  );
}

/** «ليالي» features: glass cards with gradient icons, or a glowing vertical timeline. */
export function LayaliFeatures({ props, variant, ctx }: SectionProps<FeaturesProps>) {
  const items = (props.items ?? []).filter((item: FeatureItem) => item?.title?.trim() || item?.description?.trim());
  if (items.length === 0) return null;

  if (variant === "glow-timeline") {
    return (
      <section className="relative px-4 py-20 md:py-28">
        <div className="mx-auto max-w-3xl">
          <Heading props={props} />
          <ol data-reveal-stagger className="relative flex flex-col gap-10 border-s l-line ps-8">
            {items.map((item, i) => {
              const image = mediaOf(ctx, item.image_media_id);
              return (
                <li key={i} className="relative">
                  <span className="absolute -start-[2.85rem] top-0 flex size-9 items-center justify-center rounded-full text-sm font-bold tabular-nums shadow-[0_0_24px_var(--c-primary)]" style={{ background: "linear-gradient(135deg, var(--c-primary), var(--c-accent))", color: "var(--c-primary-fg)" }}>
                    {i + 1}
                  </span>
                  <h3 className="t-heading text-xl font-bold">{item.title}</h3>
                  {item.description ? <p className="t-muted mt-2 leading-relaxed">{item.description}</p> : null}
                  {image ? <ResponsiveImage image={image} sizes="(min-width: 768px) 640px, 90vw" className="mt-4 aspect-video w-full rounded-2xl object-cover ring-1 ring-white/10" /> : null}
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <Heading props={props} />
        <ul data-reveal-stagger className={cn("grid gap-5", COLS[props.columns] ?? COLS["3"])}>
          {items.map((item, i) => {
            const image = mediaOf(ctx, item.image_media_id);
            return (
              <li key={i} className="l-glass group rounded-[1.75rem] p-7 transition-transform duration-300 hover:-translate-y-1">
                {image ? (
                  <ResponsiveImage image={image} sizes="(min-width: 1024px) 25vw, 50vw" className="mb-5 aspect-square w-20 rounded-2xl object-cover" />
                ) : (
                  <span className="mb-5 flex size-14 items-center justify-center rounded-2xl shadow-[0_10px_30px_-8px_var(--c-primary)] transition-transform duration-300 group-hover:scale-110" style={{ background: "linear-gradient(135deg, var(--c-primary), var(--c-accent))", color: "var(--c-primary-fg)" }}>
                    <IconView name={item.icon} className="size-6" />
                  </span>
                )}
                <h3 className="t-heading text-lg font-bold">{item.title}</h3>
                {item.description ? <p className="t-muted mt-2 text-sm leading-relaxed">{item.description}</p> : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
