import { Plus } from "lucide-react";
import type { FaqProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";

/**
 * Native <details> accordion (keyboard + screen readers for free). When only one
 * answer may be open, all items share a `name` (exclusive accordion, no JS).
 */
function Items({ props, sectionId }: { props: FaqProps; sectionId: string }) {
  const items = (props.items ?? []).filter((item) => item?.question?.trim());
  const group = props.allow_multiple ? undefined : `faq-${sectionId}`;
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <details key={i} name={group} open={props.first_open && i === 0} className="t-acc group t-tint rounded-2xl px-5 py-1 transition-[background,box-shadow] duration-300 open:shadow-[0_8px_30px_rgba(0,0,0,.06)] open:[background:var(--c-bg)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold">
            {item.question}
            <span className="t-primary flex size-7 shrink-0 items-center justify-center rounded-full">
              <Plus className="size-4 transition-transform duration-300 group-open:rotate-45 group-data-[closing]:rotate-0" aria-hidden />
            </span>
          </summary>
          {item.answer ? <p className="t-muted whitespace-pre-line pb-5 leading-relaxed">{item.answer}</p> : null}
        </details>
      ))}
    </div>
  );
}

export function MalakFaq({ props, variant, sectionId }: SectionProps<FaqProps>) {
  if (!(props.items ?? []).some((item) => item?.question?.trim())) return null;

  if (variant === "two-columns") {
    return (
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1fr_1.6fr]">
          <div>
            {props.title ? <h2 className="t-heading text-2xl font-bold md:text-3xl">{props.title}</h2> : null}
            {props.subtitle ? <p className="t-muted mt-3 leading-relaxed">{props.subtitle}</p> : null}
          </div>
          <Items props={props} sectionId={sectionId} />
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center">
          {props.title ? <h2 className="t-heading text-2xl font-bold md:text-3xl">{props.title}</h2> : null}
          {props.subtitle ? <p className="t-muted mt-3">{props.subtitle}</p> : null}
        </div>
        <Items props={props} sectionId={sectionId} />
      </div>
    </section>
  );
}
