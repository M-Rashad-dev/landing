import { Plus } from "lucide-react";
import type { FaqProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";

export function CeliaFaq({ props, variant, sectionId }: SectionProps<FaqProps>) {
  const items = (props.items ?? []).filter((item) => item?.question?.trim());
  if (items.length === 0) return null;
  const group = props.allow_multiple ? undefined : `faq-${sectionId}`;
  const numbered = variant === "numbered";

  return (
    <section className="t-bg border-t-[3px] t-line px-4 py-12 md:py-16">
      <div className="mx-auto max-w-4xl">
        {props.title ? <h2 className="t-heading text-3xl font-black uppercase tracking-tight md:text-5xl">{props.title}</h2> : null}
        {props.subtitle ? <p className="t-muted mt-2">{props.subtitle}</p> : null}
        <div className="mt-10 border-t-[3px] t-line">
          {items.map((item, i) => (
            <details key={i} name={group} open={props.first_open && i === 0} className="group border-b-[3px] t-line">
              <summary className="flex cursor-pointer list-none items-center gap-4 py-5">
                {numbered ? (
                  <span className="t-heading w-14 shrink-0 text-4xl font-black tabular-nums t-primary-text" dir="ltr">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                ) : null}
                <span className="flex-1 text-lg font-extrabold">{item.question}</span>
                <Plus className="size-7 shrink-0 transition-transform duration-200 group-open:rotate-45" strokeWidth={3} aria-hidden />
              </summary>
              {item.answer ? <p className={numbered ? "whitespace-pre-line pb-6 ps-[4.5rem] leading-relaxed opacity-80" : "whitespace-pre-line pb-6 leading-relaxed opacity-80"}>{item.answer}</p> : null}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
