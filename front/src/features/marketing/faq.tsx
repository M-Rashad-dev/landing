"use client";

import { Plus } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

/** Questions that open one at a time, with a smooth height change. */
export function Faq() {
  const [open, setOpen] = React.useState(0);
  return (
    <div>
      {ar.marketing.faq.items.map((item, i) => {
        const on = open === i;
        return (
          <div key={item.q} className="border-t border-border" data-reveal style={{ "--d": `${i * 60}ms` } as React.CSSProperties}>
            <h3>
              <button type="button" aria-expanded={on} aria-controls={`faq-${i}`} id={`faq-q-${i}`} onClick={() => setOpen(on ? -1 : i)} className="flex w-full items-center gap-6 py-6 text-start font-display text-lg font-medium md:text-xl">
                <span className="flex-1">{item.q}</span>
                <Plus className={cn("size-6 shrink-0 text-ink-3 transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)]", on && "rotate-45 text-ink")} aria-hidden />
              </button>
            </h3>
            <div id={`faq-${i}`} role="region" aria-labelledby={`faq-q-${i}`} className={cn("grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)]", on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
              <p className="overflow-hidden pe-12 text-[17px] leading-relaxed text-ink-2">
                <span className="block pb-6">{item.a}</span>
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
