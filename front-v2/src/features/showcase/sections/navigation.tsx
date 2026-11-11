"use client";

import { Download, Plus } from "lucide-react";
import { useState } from "react";
import { Checklist, Steps } from "@/components/data/details";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Segmented, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ar } from "@/messages/ar";
import { ShowSection, Specimen } from "../frame";

const n = ar.showcase.navigation;

export function NavigationSection() {
  const [range, setRange] = useState<"d7" | "d30" | "d90">("d30");
  const [step, setStep] = useState(1);
  const tabs = [
    { value: "all", label: n.tabNames.all, count: 28 },
    { value: "new", label: n.tabNames.new, count: 3 },
    { value: "confirmed", label: n.tabNames.confirmed, count: 11 },
    { value: "delivered", label: n.tabNames.delivered, count: 0 },
  ];

  return (
    <ShowSection id="navigation" title={ar.showcase.sections.navigation.title} description={ar.showcase.sections.navigation.description}>
      <Specimen label={n.headerDemo} stack>
        <div className="rounded-lg border border-dashed border-border-strong p-4">
          <PageHeader
            className="mb-0"
            crumbs={[{ label: n.crumbs.home, href: "#navigation" }, { label: n.crumbs.sales, href: "#navigation" }, { label: n.crumbs.orders }]}
            title={n.headerTitle}
            description={n.headerDescription}
            actions={
              <>
                <Button variant="outline">
                  <Download />
                  {ar.common.export}
                </Button>
                <Button>
                  <Plus />
                  {n.newOrder}
                </Button>
              </>
            }
            tabs={
              <Tabs defaultValue="all">
                <TabsList>
                  {tabs.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value} count={tab.count}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {tabs.map((tab) => (
                  <TabsContent key={tab.value} value={tab.value} className="pt-4 text-[13px] text-ink-3">
                    {n.tabContent(tab.label)}
                  </TabsContent>
                ))}
              </Tabs>
            }
          />
        </div>
      </Specimen>
      <Specimen label={n.segmented}>
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: "d7", label: n.ranges.d7 },
            { value: "d30", label: n.ranges.d30 },
            { value: "d90", label: n.ranges.d90 },
          ]}
        />
      </Specimen>
      <Specimen label={n.checklist} stack>
        <Checklist
          items={[
            { label: n.checklistItems.product, done: true },
            { label: n.checklistItems.category, done: true },
            { label: n.checklistItems.home, done: false, action: <Button size="sm" variant="outline">{n.doIt}</Button> },
            { label: n.checklistItems.domain, done: false, action: <Button size="sm" variant="outline">{n.doIt}</Button> },
            { label: n.checklistItems.enable, done: false },
          ]}
        />
      </Specimen>
      <Specimen label={n.steps} stack>
        <Steps steps={[...n.stepNames]} current={step} />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            {ar.common.previous}
          </Button>
          <Button size="sm" disabled={step >= n.stepNames.length} onClick={() => setStep((s) => s + 1)}>
            {ar.common.next}
          </Button>
        </div>
      </Specimen>
    </ShowSection>
  );
}
