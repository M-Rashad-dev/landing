"use client";

import { useState } from "react";
import { DailyAreaChart, DailyBarChart, Funnel, Legend, MultiLineChart, RankBars } from "@/components/data/charts";
import { Meter, StatCard } from "@/components/data/stat-card";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/tabs";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { ar } from "@/messages/ar";
import { DEMO_DAYS, DEMO_EMPTY_DAYS } from "../fixtures";
import { ShowSection, Specimen } from "../frame";

const s = ar.showcase.stats;
const c = ar.showcase.charts;

export function StatsSection() {
  return (
    <ShowSection id="stats" title={ar.showcase.sections.stats.title} description={ar.showcase.sections.stats.description}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={s.revenue} value={formatMoney(48500)} change={12.7} />
        <StatCard label={s.orders} value={formatNumber(210)} change={-4.2} />
        <StatCard label={s.cancelled} value={formatNumber(12)} change={-40} inverse />
        <StatCard label={s.waiting} value={formatNumber(3)} attention href="#stats" hint={s.waitingHint} />
        <StatCard label={s.conversion} value={formatPercent(2.4)} change={0} />
        <StatCard label={s.revenue} value={formatMoney(1240)} change={null} />
        <StatCard label={s.orders} value="" loading />
        <StatCard label={s.noCompare} value={formatNumber(9)} />
      </div>
      <Specimen label={s.usage} className="grid w-full gap-4 sm:grid-cols-3">
        <Meter label={s.products} used={12} limit={50} />
        <Meter label={s.categories} used={17} limit={20} />
        <Meter label={s.landings} used={5} limit={5} />
      </Specimen>
    </ShowSection>
  );
}

export function ChartsSection() {
  const [empty, setEmpty] = useState(false);
  const days = empty ? DEMO_EMPTY_DAYS : DEMO_DAYS;
  return (
    <ShowSection id="charts" title={ar.showcase.sections.charts.title} description={ar.showcase.sections.charts.description}>
      <Segmented
        value={empty ? "empty" : "data"}
        onChange={(v) => setEmpty(v === "empty")}
        options={[
          { value: "data", label: ar.showcase.sections.charts.title },
          { value: "empty", label: c.empty },
        ]}
        className="self-start"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title={c.daily} />
          <PanelBody>
            <DailyAreaChart data={days} series={{ key: "sales", label: c.seriesSales }} format={(v) => formatMoney(v)} />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader
            title={c.compare}
            actions={
              <Legend
                series={[
                  { key: "orders", label: c.seriesOrders },
                  { key: "cancelled", label: c.seriesCancelled },
                ]}
              />
            }
          />
          <PanelBody>
            <MultiLineChart
              data={days}
              series={[
                { key: "orders", label: c.seriesOrders },
                { key: "cancelled", label: c.seriesCancelled },
              ]}
            />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title={c.bars} />
          <PanelBody>
            <DailyBarChart data={days.slice(-14)} series={{ key: "orders", label: c.seriesOrders }} />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title={c.sources} />
          <PanelBody>
            <RankBars
              items={
                empty
                  ? []
                  : [
                      { label: c.sourcesNames.facebook, value: 1840, hint: c.sourceOrders(38) },
                      { label: c.sourcesNames.instagram, value: 920 },
                      { label: c.sourcesNames.tiktok, value: 610 },
                      { label: c.sourcesNames.google, value: 230 },
                      { label: c.sourcesNames.direct, value: 140 },
                    ]
              }
            />
          </PanelBody>
        </Panel>
        <Panel className="lg:col-span-2">
          <PanelHeader title={c.funnel} />
          <PanelBody>
            <Funnel
              steps={[
                { label: c.funnelSteps.views, value: 3740 },
                { label: c.funnelSteps.product, value: 2210 },
                { label: c.funnelSteps.cart, value: 610 },
                { label: c.funnelSteps.checkout, value: 240 },
                { label: c.funnelSteps.orders, value: 92 },
              ]}
            />
          </PanelBody>
        </Panel>
      </div>
    </ShowSection>
  );
}
