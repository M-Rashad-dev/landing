import { ChevronDown } from "lucide-react";
import type { FaqProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";

/** «ليالي» FAQ: native <details> accordion in glass, centered or beside the heading. */
export function LayaliFaq({ props, variant, sectionId }: SectionProps<FaqProps>) {
  const items = (props.items ?? []).filter((item) => item?.question?.trim());
  if (items.length === 0) return null;
  const group = props.allow_multiple ? undefined : `faq-${sectionId}`;

  const list = (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <details key={i} name={group} open={props.first_open && i === 0} className="t-acc l-glass group rounded-2xl px-5 transition-[box-shadow] duration-300 open:shadow-[0_0_0_1px_var(--c-primary),0_20px_50px_-25px_var(--c-primary)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold">
            {item.question}
            <ChevronDown className="size-5 shrink-0 text-[var(--c-accent)] transition-transform duration-300 group-open:rotate-180 group-data-[closing]:rotate-0" aria-hidden />
          </summary>
          {item.answer ? <p className="t-muted whitespace-pre-line pb-5 leading-loose">{item.answer}</p> : null}
        </details>
      ))}
    </div>
  );

  if (variant === "split-glow") {
    return (
      <section className="relative px-4 py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1fr_1.6fr]">
          <div className="md:sticky md:top-28 md:h-fit">
            <span className="l-eyebrow">FAQ</span>
            {props.title ? <h2 className="t-heading l-grad-text mt-3 text-3xl font-bold md:text-4xl">{props.title}</h2> : null}
            {props.subtitle ? <p className="t-muted mt-4 leading-relaxed">{props.subtitle}</p> : null}
          </div>
          {list}
        </div>
      </section>
    );
  }

  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          {props.title ? <h2 className="t-heading l-grad-text text-3xl font-bold md:text-4xl">{props.title}</h2> : null}
          {props.subtitle ? <p className="t-muted mt-4">{props.subtitle}</p> : null}
        </div>
        {list}
      </div>
    </section>
  );
}
