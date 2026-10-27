import { ProofImage } from "@/themes/shared/components/proof-image";
import { RatingStars } from "@/themes/shared/components/rating-stars";
import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import type { TestimonialItem, TestimonialsProps } from "@/themes/shared/schemas";
import type { PageContext, SectionProps } from "@/themes/types";
import { mediaOf } from "@/themes/shared/utils";
import { cn } from "@/lib/utils";

function Author({ item, ctx }: { item: TestimonialItem; ctx: PageContext }) {
  const avatar = mediaOf(ctx, item.avatar_media_id);
  return (
    <figcaption className="flex items-center gap-3">
      {avatar ? <ResponsiveImage image={avatar} sizes="44px" className="size-11 border-2 t-line object-cover" /> : null}
      <span>
        <span className="block font-extrabold">{item.name}</span>
        {item.subtitle ? <span className="t-muted block text-sm">{item.subtitle}</span> : null}
      </span>
    </figcaption>
  );
}

export function CeliaTestimonials({ props, variant, ctx }: SectionProps<TestimonialsProps>) {
  const items = (props.items ?? []).filter((item) => item?.name?.trim() || item?.text?.trim() || item?.proof_media_id);
  if (items.length === 0) return null;

  const heading = props.title ? <h2 className="t-heading mb-10 text-3xl font-black uppercase tracking-tight md:text-5xl">{props.title}</h2> : null;

  if (variant === "screenshots-grid") {
    return (
      <section className="t-bg border-t-[3px] t-line px-4 py-12 md:py-16">
        <div className="mx-auto max-w-6xl">
          {heading}
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {items.map((item, i) => {
              const proof = mediaOf(ctx, item.proof_media_id);
              return (
                <li key={i}>
                  {proof ? (
                    <figure className="flex flex-col gap-2">
                      <ProofImage image={proof} className="t-hard" imageClassName="aspect-[3/4]" />
                      {item.name ? <figcaption className="text-sm font-bold">{item.name}</figcaption> : null}
                    </figure>
                  ) : (
                    <figure className="t-hard flex h-full flex-col gap-3 p-4">
                      {props.show_rating ? <RatingStars rating={item.rating ?? 5} /> : null}
                      {item.text ? <blockquote className="flex-1 text-sm font-medium">{item.text}</blockquote> : null}
                      <Author item={item} ctx={ctx} />
                    </figure>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    );
  }

  // quote-wall
  return (
    <section className="t-bg border-t-[3px] t-line px-4 py-12 md:py-16">
      <div className="mx-auto max-w-6xl">
        {heading}
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
          {items.map((item, i) => {
            const proof = mediaOf(ctx, item.proof_media_id);
            const big = i % 3 === 0;
            return (
              <figure key={i} className={cn("t-hard relative mb-5 flex break-inside-avoid flex-col gap-4 p-6", big ? "t-inverse" : "t-bg")}>
                <span className="t-heading absolute end-4 top-1 text-7xl font-black leading-none opacity-20" aria-hidden>
                  ”
                </span>
                {props.show_rating ? <RatingStars rating={item.rating ?? 5} /> : null}
                {item.text ? <blockquote className={cn("relative font-bold leading-relaxed", big ? "text-xl" : "text-base")}>{item.text}</blockquote> : null}
                {proof ? <ProofImage image={proof} className="border-2 border-current" imageClassName="max-h-56" /> : null}
                <Author item={item} ctx={ctx} />
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
