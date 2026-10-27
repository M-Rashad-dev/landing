import { ProofImage } from "@/themes/shared/components/proof-image";
import { RatingStars } from "@/themes/shared/components/rating-stars";
import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import { Slider } from "@/themes/shared/components/slider";
import type { TestimonialItem, TestimonialsProps } from "@/themes/shared/schemas";
import type { PageContext, SectionProps } from "@/themes/types";
import { mediaOf } from "@/themes/shared/utils";

function Card({ item, ctx, showRating }: { item: TestimonialItem; ctx: PageContext; showRating: boolean }) {
  const avatar = mediaOf(ctx, item.avatar_media_id);
  const proof = mediaOf(ctx, item.proof_media_id);
  return (
    <figure className="t-bg flex h-full flex-col gap-4 rounded-3xl border t-border p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)]">
      {showRating ? <RatingStars rating={item.rating ?? 5} /> : null}
      {item.text ? <blockquote className="flex-1 leading-relaxed">«{item.text}»</blockquote> : null}
      {proof ? <ProofImage image={proof} className="rounded-2xl" imageClassName="max-h-48" /> : null}
      <figcaption className="flex items-center gap-3">
        {avatar ? (
          <ResponsiveImage image={avatar} sizes="48px" className="size-12 rounded-full object-cover" />
        ) : (
          <span className="t-tint-strong t-primary-text flex size-12 items-center justify-center rounded-full text-lg font-bold">{item.name?.trim().charAt(0) || "؟"}</span>
        )}
        <span>
          <span className="block font-bold">{item.name}</span>
          {item.subtitle ? <span className="t-muted block text-sm">{item.subtitle}</span> : null}
        </span>
      </figcaption>
    </figure>
  );
}

export function MalakTestimonials({ props, variant, ctx }: SectionProps<TestimonialsProps>) {
  const items = (props.items ?? []).filter((item) => item?.name?.trim() || item?.text?.trim() || item?.proof_media_id);
  if (items.length === 0) return null;

  return (
    <section className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        {props.title ? <h2 className="t-heading mb-10 text-center text-2xl font-bold md:text-3xl">{props.title}</h2> : null}
        {variant === "grid" ? (
          <ul data-reveal-stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, i) => (
              <li key={i}>
                <Card item={item} ctx={ctx} showRating={props.show_rating} />
              </li>
            ))}
          </ul>
        ) : (
          <Slider slideClassName="sm:basis-1/2 lg:basis-1/3 py-2">
            {items.map((item, i) => (
              <Card key={i} item={item} ctx={ctx} showRating={props.show_rating} />
            ))}
          </Slider>
        )}
      </div>
    </section>
  );
}
