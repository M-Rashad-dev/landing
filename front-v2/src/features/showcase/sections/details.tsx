"use client";

import { CheckCircle2, MessageSquareText, PhoneMissed, ShoppingBag, Truck } from "lucide-react";
import { CopyField, DescriptionList, EntityCell, Price, Timeline } from "@/components/data/details";
import { OrderStatusBadge } from "@/components/domain/order-status";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { ar } from "@/messages/ar";
import { DEMO_THUMB } from "../fixtures";
import { ShowSection, Specimen } from "../frame";

const d = ar.showcase.details;

export function DetailsSection() {
  return (
    <ShowSection id="details" title={ar.showcase.sections.details.title} description={ar.showcase.sections.details.description}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title={d.order} actions={<OrderStatusBadge status="confirmed" />} />
          <PanelBody className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-6">
              <EntityCell avatar="سارة أحمد" title="سارة أحمد" subtitle={<span dir="ltr">01012345678</span>} />
              <EntityCell image={DEMO_THUMB} title="قميص كتان" subtitle={<Price value={300} compareAt={380} size="sm" />} />
            </div>
            <DescriptionList
              items={[
                { label: d.fields.phone, value: <span dir="ltr">01012345678</span> },
                { label: d.fields.governorate, value: "الجيزة" },
                { label: d.fields.address, value: "15 شارع التحرير، الدقي", wide: true },
                { label: d.fields.payment, value: d.cod },
                { label: d.fields.notes, value: "" },
              ]}
            />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title={d.history} />
          <PanelBody>
            <Timeline
              events={[
                { id: 5, title: d.events.delivered, by: "محمد", at: "11/11/2026 18:12", tone: "success", icon: <Truck /> },
                { id: 4, title: d.events.noAnswer, by: "أحمد", at: "10/11/2026 12:40", tone: "attention", icon: <PhoneMissed />, body: d.eventBodies.noAnswer },
                { id: 3, title: d.events.note, by: "محمد", at: "10/11/2026 10:05", tone: "neutral", icon: <MessageSquareText />, body: d.eventBodies.note },
                { id: 2, title: d.events.confirmed, by: "محمد", at: "09/11/2026 16:30", tone: "brand", icon: <CheckCircle2 /> },
                { id: 1, title: d.events.created, at: "09/11/2026 15:29", tone: "neutral", icon: <ShoppingBag /> },
              ]}
            />
          </PanelBody>
        </Panel>
      </div>
      <Specimen label={d.copyTitle} className="grid w-full gap-4 sm:grid-cols-2">
        <CopyField label={d.account} value="maksab@instapay" />
        <CopyField label={d.storeCode} value="ST-00025" />
      </Specimen>
      <Specimen label={d.price}>
        <Price value={300} />
        <Price value={300} compareAt={380} />
        <Price value={1250} compareAt={1500} size="lg" />
      </Specimen>
    </ShowSection>
  );
}
