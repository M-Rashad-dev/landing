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
    <div className="mx-auto mb-12 max-w-2xl text-center">
      {props.title ? <h2 className="t-heading text-2xl font-bold md:text-3xl">{props.title}</h2> : null}
      {props.subtitle ? <p className="t-muted mt-3 leading-relaxed">{props.subtitle}</p> : null}
    </div>
  );
}

export function MalakFeatures({ props, variant, ctx }: SectionProps<FeaturesProps>) {
  const items = (props.items ?? []).filter((item: FeatureItem) => item?.title?.trim() || item?.description?.trim());
  if (items.length === 0) return null;

  if (variant === "alternating") {
    return (
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <Heading props={props} />
          <div className="flex flex-col gap-12">
            {items.map((item, i) => {
              const image = mediaOf(ctx, item.image_media_id);
              return (
                <div key={i} className={cn("grid items-center gap-8 md:grid-cols-2", i % 2 === 1 && "md:[&>*:first-child]:order-last")}>
                  {image ? (
                    <ResponsiveImage image={image} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-[0_8px_30px_rgba(0,0,0,.06)]" />
                  ) : (
                    <div className="t-tint flex aspect-[4/3] items-center justify-center rounded-3xl">
                      <IconView name={item.icon} className="size-16 t-primary-text" />
                    </div>
                  )}
                  <div>
                    <h3 className="t-heading text-xl font-bold md:text-2xl">{item.title}</h3>
                    {item.description ? <p className="t-muted mt-3 leading-relaxed">{item.description}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Heading props={props} />
        <ul data-reveal-stagger className={cn("grid gap-5", COLS[props.columns] ?? COLS["3"])}>
          {items.map((item, i) => {
            const image = mediaOf(ctx, item.image_media_id);
            return (
              <li key={i} className="t-bg rounded-3xl border t-border p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,.06)] transition-transform hover:-translate-y-1">
                {image ? (
                  <ResponsiveImage image={image} sizes="(min-width: 1024px) 25vw, 50vw" className="mx-auto mb-4 aspect-square w-24 rounded-2xl object-cover" />
                ) : (
                  <span className="t-tint mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                    <IconView name={item.icon} className="size-6 t-primary-text" />
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
