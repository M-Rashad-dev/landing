"use client";

import { Copy, Download, Eye, MoreVertical, Pencil, Plus, Rocket, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { Badge, CountBadge } from "@/components/ui/badge";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { InvoiceStatusBadge, ORDER_STATUSES, OrderStatusBadge, type InvoiceStatus } from "@/components/domain/order-status";
import { ar } from "@/messages/ar";
import { ShowSection, Specimen } from "../frame";

const t = ar.showcase.buttons;
const b = ar.showcase.badges;
const m = ar.showcase.overlays.menuItems;

export function ButtonsSection() {
  return (
    <ShowSection id="buttons" title={ar.showcase.sections.buttons.title} description={ar.showcase.sections.buttons.description}>
      <Specimen label={t.variants}>
        <Button>
          <Plus />
          {t.primary}
        </Button>
        <Button variant="brand">
          <Rocket />
          {t.brand}
        </Button>
        <Button variant="secondary">{t.secondary}</Button>
        <Button variant="outline">
          <Download />
          {t.outline}
        </Button>
        <Button variant="ghost">{t.ghost}</Button>
        <Button variant="danger">
          <Trash2 />
          {t.danger}
        </Button>
        <Button variant="danger-ghost">{t.dangerGhost}</Button>
        <Button variant="link">{t.link}</Button>
      </Specimen>
      <Specimen label={t.sizes}>
        <Button size="sm">{t.small}</Button>
        <Button size="md">{t.medium}</Button>
        <Button size="lg">{t.large}</Button>
        <Button size="icon" variant="outline" aria-label={t.iconOnly}>
          <Pencil />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label={t.iconOnly}>
          <MoreVertical />
        </Button>
      </Specimen>
      <Specimen label={t.states}>
        <Button loading>
          <Save />
          {t.loading}
        </Button>
        <Button disabled>{t.disabled}</Button>
        <Button variant="outline" disabled>
          {t.disabled}
        </Button>
        <Button variant="outline" asChild>
          <Link href="#buttons">{t.asLink}</Link>
        </Button>
        <ButtonGroup>
          <Button variant="outline" size="sm">
            {t.groupItems.day}
          </Button>
          <Button variant="outline" size="sm">
            {t.groupItems.week}
          </Button>
          <Button variant="outline" size="sm">
            {t.groupItems.month}
          </Button>
        </ButtonGroup>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="outline">
              {t.withMenu}
              <MoreVertical />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem>
              <Eye />
              {m.view}
            </MenuItem>
            <MenuItem>
              <Copy />
              {m.duplicate}
            </MenuItem>
            <MenuSeparator />
            <MenuItem destructive>
              <Trash2 />
              {m.delete}
            </MenuItem>
          </MenuContent>
        </Menu>
      </Specimen>
    </ShowSection>
  );
}

export function BadgesSection() {
  const invoices: InvoiceStatus[] = ["open", "pending_review", "paid", "refunded", "expired", "cancelled"];
  return (
    <ShowSection id="badges" title={ar.showcase.sections.badges.title} description={ar.showcase.sections.badges.description}>
      <Specimen label={b.orders}>
        {ORDER_STATUSES.map((s) => (
          <OrderStatusBadge key={s} status={s} />
        ))}
      </Specimen>
      <Specimen label={b.invoices}>
        {invoices.map((s) => (
          <InvoiceStatusBadge key={s} status={s} />
        ))}
      </Specimen>
      <Specimen label={b.product}>
        <Badge tone="success" dot>
          {ar.domain.productState.active}
        </Badge>
        <Badge tone="neutral" dot>
          {ar.domain.productState.inactive}
        </Badge>
        <Badge tone="danger">{ar.domain.productState.outOfStock}</Badge>
        <Badge tone="attention">{ar.domain.productState.lowStock(3)}</Badge>
        <Badge tone="warning">{ar.domain.productState.overLimit}</Badge>
      </Specimen>
      <Specimen label={b.tones}>
        {(["neutral", "brand", "brand-soft", "attention", "success", "warning", "danger", "info", "ink"] as const).map((tone) => (
          <Badge key={tone} tone={tone}>
            <span dir="ltr">{tone}</span>
          </Badge>
        ))}
      </Specimen>
      <Specimen label={b.counts}>
        <CountBadge value={3} />
        <CountBadge value={12} tone="attention" />
        <CountBadge value={128} tone="brand" />
      </Specimen>
      <Specimen label={b.misc}>
        <Badge tone="brand" size="sm">
          {b.new}
        </Badge>
        <Badge tone="neutral" size="sm">
          {b.soon}
        </Badge>
        <Badge tone="ink" size="sm">
          {b.featured}
        </Badge>
        <Badge tone="info">{ar.domain.source.store}</Badge>
        <Badge tone="neutral">{ar.domain.source.landing}</Badge>
      </Specimen>
    </ShowSection>
  );
}
