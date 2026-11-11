"use client";

import { Check, ExternalLink, Eye, PencilRuler, ShoppingBag, X } from "lucide-react";
import { Price } from "@/components/data/details";
import { useShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd, Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { DEMO_THEME_COVER, DEMO_THUMB } from "../fixtures";
import { ShowSection, Specimen, Tile } from "../frame";

const p = ar.showcase.platform;
const l = ar.showcase.layout;

export function LayoutSection() {
  const { openSearch } = useShell();
  return (
    <ShowSection id="layout" title={ar.showcase.sections.layout.title} description={ar.showcase.sections.layout.description}>
      <Specimen label={l.sidebar}>
        <p className="text-sm text-ink-2">{l.sidebarText}</p>
      </Specimen>
      <Specimen label={l.topbar}>
        <p className="flex-1 text-sm text-ink-2">{l.topbarText}</p>
        <Button variant="outline" onClick={openSearch}>
          {l.openSearch}
          <Kbd>Ctrl K</Kbd>
        </Button>
      </Specimen>
    </ShowSection>
  );
}

export function PlatformSection() {
  return (
    <ShowSection id="platform" title={ar.showcase.sections.platform.title} description={ar.showcase.sections.platform.description}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label={p.productCard}>
          <article className="overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element -- demo image */}
            <img src={DEMO_THUMB} alt="" className="aspect-square w-full object-cover" />
            <div className="flex flex-col gap-2 p-3">
              <p className="font-semibold">قميص كتان</p>
              <Price value={300} compareAt={380} size="sm" />
              <Button size="sm" className="w-full">
                <ShoppingBag />
                {p.addToCart}
              </Button>
            </div>
          </article>
        </Tile>

        <Tile label={p.themeCard}>
          <article className="overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element -- demo image */}
            <img src={DEMO_THEME_COVER} alt="" className="aspect-[4/3] w-full object-cover" />
            <div className="flex flex-col gap-2 p-3">
              <p className="flex items-center justify-between font-semibold">
                ديوان
                <Badge tone="brand" size="sm">
                  {ar.showcase.badges.new}
                </Badge>
              </p>
              <p className="tabular text-sm">{formatMoney(200)}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1">
                  <Eye />
                  {p.previewTheme}
                </Button>
                <Button size="sm" className="flex-1">
                  {ar.domain.theme.buy(formatMoney(200))}
                </Button>
              </div>
            </div>
          </article>
        </Tile>

        <Tile label={p.planCard}>
          <article className="relative mt-2 rounded-xl border-2 border-brand p-4">
            <Badge tone="brand" size="sm" className="absolute -top-2.5 start-4">
              {p.recommended}
            </Badge>
            <p className="font-display text-lg font-bold">{ar.domain.plan.pro}</p>
            <p className="mt-1">
              <span className="tabular font-display text-2xl font-bold">100</span> <span className="text-xs text-ink-3">ج.م · {ar.domain.plan.perMonth}</span>
            </p>
            <ul className="mt-3 flex flex-col gap-1.5 text-[13px]">
              {p.planFeatures.map((feature) => (
                <li key={feature.label} className={feature.included ? "flex items-center gap-2" : "flex items-center gap-2 text-ink-3"}>
                  {feature.included ? (
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                      <Check className="size-3" strokeWidth={3} aria-label={p.included} />
                    </span>
                  ) : (
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-3">
                      <X className="size-3" strokeWidth={3} aria-label={p.notIncluded} />
                    </span>
                  )}
                  <span className={feature.included ? undefined : "line-through decoration-ink-3/50"}>{feature.label}</span>
                </li>
              ))}
            </ul>
            <Button className="mt-4 w-full">{ar.domain.plan.choose}</Button>
          </article>
        </Tile>

        <Tile label={p.invoice}>
          <div>
            <p className="font-semibold">{p.invoiceItem}</p>
            <dl className="mt-3 divide-y divide-border text-sm">
              {[
                [p.subtotal, formatMoney(100)],
                [p.discount, `− ${formatMoney(0)}`],
                [p.credit, `− ${formatMoney(40)}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="tabular">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between py-2 font-bold">
                <dt>{p.toPay}</dt>
                <dd className="tabular font-display text-lg">{formatMoney(60)}</dd>
              </div>
            </dl>
          </div>
        </Tile>
      </div>

      <Panel>
        <PanelHeader title={p.storeStatus} actions={<Badge tone="success" dot>{ar.domain.storeState.live}</Badge>} />
        <PanelBody>
          <p className="font-semibold">{p.storeLive}</p>
          <p className="text-[13px] text-ink-3">{p.storeLiveText}</p>
        </PanelBody>
        <PanelFooter>
          <Button variant="outline">
            <ExternalLink />
            {p.visit}
          </Button>
          <Button>
            <PencilRuler />
            {p.editHome}
          </Button>
        </PanelFooter>
      </Panel>
    </ShowSection>
  );
}
