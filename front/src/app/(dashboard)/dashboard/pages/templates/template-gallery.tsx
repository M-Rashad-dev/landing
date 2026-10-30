"use client";

import { useState } from "react";
import { NICHE_ICONS, TemplateCard } from "@/components/pages/template-card";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { TEMPLATES, type TemplateNiche } from "@/themes/templates";

const t = ar.templates;
const NICHES = Object.keys(t.niches) as TemplateNiche[];

export function TemplateGallery() {
  const [niche, setNiche] = useState<TemplateNiche | "all">("all");
  const list = niche === "all" ? TEMPLATES : TEMPLATES.filter((template) => template.niche === niche);

  const chip = (key: TemplateNiche | "all", label: string, Icon?: (typeof NICHE_ICONS)[TemplateNiche]) => (
    <button
      key={key}
      type="button"
      aria-pressed={niche === key}
      onClick={() => setNiche(key)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        niche === key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {Icon ? <Icon className="size-4" aria-hidden /> : null}
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {chip("all", t.all)}
        {NICHES.map((key) => chip(key, t.niches[key].name, NICHE_ICONS[key]))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((template) => (
          <TemplateCard key={template.key} template={template} href={`/dashboard/pages/new?template=${template.key}`} />
        ))}
      </div>
    </div>
  );
}
