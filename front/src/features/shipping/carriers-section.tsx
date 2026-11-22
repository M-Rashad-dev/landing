"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Copy, Link2, MoreHorizontal, PlugZap, RefreshCw, Settings2, Truck, Unplug } from "lucide-react";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Alert, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Drawer, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import { shippingKeys, useShipping, type Company } from "./api";
import {
  checkCarrier,
  connectCarrier,
  disconnectCarrier,
  requestPickup,
  saveCarrierSettings,
  useCarrierDistricts,
  useCarrierLocations,
  useCarriers,
  useRefreshCarriers,
  type Carrier,
  type CarrierAccount,
  type CarrierSettings,
} from "./carriers-api";

const t = ar.carriers;

/** «ربط شركات الشحن» on the shipping page: each carrier the store can connect, connected or not. */
export function CarriersSection({ companies, onEditCompany }: { companies: Company[]; onEditCompany: (id: number) => void }) {
  const query = useCarriers();
  const [connecting, setConnecting] = React.useState<Carrier | null>(null);
  const [settings, setSettings] = React.useState<Carrier | null>(null);
  const [pickup, setPickup] = React.useState<Carrier | null>(null);
  const [disconnecting, setDisconnecting] = React.useState<Carrier | null>(null);
  const [busy, setBusy] = React.useState(false);
  const refresh = useRefreshCarriers();
  const client = useQueryClient();

  async function onCheck(c: Carrier) {
    try {
      await checkCarrier(c.key);
      toast.success(t.checkOk);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      await refresh();
    }
  }

  async function onDisconnect() {
    if (!disconnecting) return;
    setBusy(true);
    try {
      await disconnectCarrier(disconnecting.key);
      toast.success(t.disconnected);
      setDisconnecting(null);
      await Promise.all([refresh(), client.invalidateQueries({ queryKey: shippingKeys.all })]);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader title={t.section} description={t.sectionHint} />
      <PanelBody className="flex flex-col gap-3">
        {query.isPending ? (
          <Skeleton className="h-20 rounded-lg" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
        ) : (
          query.data.map((c) => (
            <CarrierCard
              key={c.key}
              carrier={c}
              onConnect={() => setConnecting(c)}
              onSettings={() => setSettings(c)}
              onPickup={() => setPickup(c)}
              onCheck={() => void onCheck(c)}
              onDisconnect={() => setDisconnecting(c)}
              onEditCompany={onEditCompany}
            />
          ))
        )}
      </PanelBody>

      <ConnectDialog carrier={connecting} companies={companies} onClose={() => setConnecting(null)} />
      <SettingsDrawer carrier={settings} onClose={() => setSettings(null)} />
      <PickupDialog carrier={pickup} onClose={() => setPickup(null)} />
      <ConfirmDialog
        open={disconnecting !== null}
        onOpenChange={(o) => !o && setDisconnecting(null)}
        title={disconnecting ? t.disconnectTitle(disconnecting.name) : ""}
        description={t.disconnectText(disconnecting?.account?.open_shipments ?? 0)}
        confirmLabel={t.disconnect}
        destructive
        loading={busy}
        onConfirm={() => void onDisconnect()}
      />
    </Panel>
  );
}

function CarrierCard({
  carrier,
  onConnect,
  onSettings,
  onPickup,
  onCheck,
  onDisconnect,
  onEditCompany,
}: {
  carrier: Carrier;
  onConnect: () => void;
  onSettings: () => void;
  onPickup: () => void;
  onCheck: () => void;
  onDisconnect: () => void;
  onEditCompany: (id: number) => void;
}) {
  const a = carrier.account;
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-strong">
          <Truck className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {carrier.name}
            {a ? (
              <Badge tone={a.status === "active" ? "success" : "danger"} dot>
                {a.status === "active" ? t.connected : t.failed}
              </Badge>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-ink-3">
            {a ? [a.account_name ? t.account(a.account_name) : null, a.company ? t.forCompany(a.company.name) : null, t.openShipments(a.open_shipments)].filter(Boolean).join(" · ") : t.pitch(carrier.name)}
          </p>
        </div>
        {a ? (
          <div className="flex items-center gap-2">
            {carrier.features.includes("pickup") ? (
              <Button size="sm" variant="outline" onClick={onPickup} disabled={a.status !== "active"}>
                <CalendarClock />
                {t.pickup}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={onSettings}>
              <Settings2 />
              {t.settings}
            </Button>
            <Menu>
              <MenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={ar.common.actions}>
                  <MoreHorizontal />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={onCheck}>
                  <RefreshCw />
                  {t.check}
                </MenuItem>
                <MenuItem onSelect={onConnect}>
                  <Link2 />
                  {t.changeKey}
                </MenuItem>
                <MenuSeparator />
                <MenuItem destructive onSelect={onDisconnect}>
                  <Unplug />
                  {t.disconnect}
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        ) : (
          <Button size="sm" onClick={onConnect}>
            <PlugZap />
            {t.connect}
          </Button>
        )}
      </div>
      {a?.status === "failed" && a.last_error ? (
        <Alert tone="danger" className="mt-3" action={<Button size="sm" variant="outline" onClick={onConnect}>{t.changeKey}</Button>}>
          {a.last_error}
        </Alert>
      ) : null}
      {a && carrier.webhook_url ? (
        <div className="mt-3 rounded-lg bg-surface-2 p-3">
          <p className="text-xs font-semibold text-ink-2">{t.webhook}</p>
          <div className="mt-1 flex items-center gap-2">
            <code dir="ltr" className="min-w-0 flex-1 truncate text-xs">
              {carrier.webhook_url}
            </code>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={ar.common.copy}
              onClick={() => void navigator.clipboard.writeText(carrier.webhook_url ?? "").then(() => toast.success(t.copied))}
            >
              <Copy />
            </Button>
          </div>
          <p className="mt-1 text-xs text-ink-3">{t.webhookHint(carrier.name)}</p>
        </div>
      ) : null}
      {a?.company && !a.company.is_active ? (
        <Alert tone="warning" className="mt-3" action={<Button size="sm" variant="outline" onClick={() => onEditCompany(a.company!.id)}>{t.setPrices}</Button>}>
          {t.companyOff}
        </Alert>
      ) : null}
    </div>
  );
}

const connectSchema = z.object({
  credentials: z.record(z.string(), z.string().trim().min(2, ar.validation.min(2)).max(500, ar.validation.max(500))),
  company: z.string(),
});

function ConnectDialog({ carrier, companies, onClose }: { carrier: Carrier | null; companies: Company[]; onClose: () => void }) {
  return (
    <Dialog open={carrier !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">{carrier ? <ConnectForm key={carrier.key} carrier={carrier} companies={companies} onDone={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}

function ConnectForm({ carrier, companies, onDone }: { carrier: Carrier; companies: Company[]; onDone: () => void }) {
  const refresh = useRefreshCarriers();
  const client = useQueryClient();
  const [formError, setFormError] = React.useState<string | null>(null);
  const linkable = companies.filter((c) => !c.carrier || c.carrier === carrier.key);
  const form = useForm<z.infer<typeof connectSchema>>({
    resolver: zodResolver(connectSchema),
    defaultValues: { credentials: Object.fromEntries(carrier.fields.map((f) => [f.key, ""])), company: carrier.account?.company ? String(carrier.account.company.id) : "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof connectSchema>) {
    setFormError(null);
    try {
      await connectCarrier(carrier.key, { credentials: Object.fromEntries(carrier.fields.map((f) => [f.key, (values.credentials[f.key] ?? "").trim()])), company_id: values.company ? Number(values.company) : null });
      toast.success(t.connectDialog.done(carrier.name));
      await Promise.all([refresh(), client.invalidateQueries({ queryKey: shippingKeys.all })]);
      onDone();
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, carrier.fields.map((f) => `credentials.${f.key}` as const));
      if (unmatched.length || !(isApiError(error) && error.isValidation)) setFormError(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-col">
      <DialogHeader title={t.connectDialog.title(carrier.name)} description={t.connectDialog.description} />
      <DialogBody className="flex flex-col gap-4">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <ol className="flex list-decimal flex-col gap-1 ps-5 text-sm text-ink-2">
          {(t.connectDialog.steps[carrier.key] ?? []).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {carrier.fields.map((f, i) => (
          <Field key={f.key} label={f.label} htmlFor={`carrier-${f.key}`} error={errors.credentials?.[f.key]?.message} required>
            <Input
              id={`carrier-${f.key}`}
              dir="ltr"
              type={f.secret ? "password" : "text"}
              autoComplete="off"
              autoFocus={i === 0}
              placeholder={t.connectDialog.keyPlaceholder}
              aria-invalid={!!errors.credentials?.[f.key]}
              {...form.register(`credentials.${f.key}`)}
            />
          </Field>
        ))}
        {linkable.length > 0 ? (
          <Field label={t.connectDialog.company} hint={t.connectDialog.companyHint}>
            <Controller
              control={form.control}
              name="company"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} emptyLabel={t.connectDialog.newCompany(carrier.name)} options={linkable.map((c) => ({ value: String(c.id), label: c.name }))} aria-label={t.connectDialog.company} />
              )}
            />
          </Field>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          {ar.common.cancel}
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {t.connectDialog.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SettingsDrawer({ carrier, onClose }: { carrier: Carrier | null; onClose: () => void }) {
  return (
    <Drawer open={carrier !== null} onOpenChange={(o) => !o && onClose()} title={carrier ? t.settingsDrawer.title(carrier.name) : ""}>
      {carrier?.account ? <SettingsForm key={carrier.key} carrier={carrier} account={carrier.account} onDone={onClose} /> : null}
    </Drawer>
  );
}

function SettingsForm({ carrier, account, onDone }: { carrier: Carrier; account: CarrierAccount; onDone: () => void }) {
  const s = t.settingsDrawer;
  const refresh = useRefreshCarriers();
  const locations = useCarrierLocations(carrier.key, carrier.features.includes("locations"));
  const [values, setValues] = React.useState<CarrierSettings>(account.settings);
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof CarrierSettings>(key: K, value: CarrierSettings[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function save() {
    setBusy(true);
    try {
      await saveCarrierSettings(carrier.key, { ...values, notes: values.notes?.trim() || null });
      toast.success(s.saved);
      await refresh();
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const options = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((k) => ({ value: k, label: labels[k] }));

  const has = (feature: (typeof carrier.features)[number]) => carrier.features.includes(feature);

  return (
    <div className="flex flex-col gap-4">
      {has("locations") ? (
        <Field label={s.location} hint={s.locationHint}>
          {locations.isPending ? (
            <Skeleton className="h-10 rounded-md" />
          ) : locations.isError ? (
            <Alert tone="warning">{errorMessage(locations.error) || s.locationsFailed}</Alert>
          ) : (
            <Select value={values.location_id ?? ""} onValueChange={(v) => set("location_id", v || null)} options={locations.data.locations.map((l) => ({ value: l.id, label: l.name }))} aria-label={s.location} />
          )}
        </Field>
      ) : null}
      {has("sender") ? <SenderFields carrier={carrier} values={values} set={set} /> : null}
      {has("package") ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={s.packageType}>
            <Select value={values.package_type} onValueChange={(v) => set("package_type", v as CarrierSettings["package_type"])} options={options(s.packageTypes)} aria-label={s.packageType} />
          </Field>
          <Field label={s.size}>
            <Select value={values.size} onValueChange={(v) => set("size", v as CarrierSettings["size"])} options={options(s.sizes)} aria-label={s.size} />
          </Field>
        </div>
      ) : null}
      <Field label={s.labelSize}>
        <Select value={values.label_size} onValueChange={(v) => set("label_size", v as CarrierSettings["label_size"])} options={options(s.labelSizes)} aria-label={s.labelSize} />
      </Field>
      <SwitchRow title={s.allowOpen} description={s.allowOpenHint} checked={values.allow_open} onCheckedChange={(v) => set("allow_open", v)} />
      <SwitchRow title={s.autoShip} description={s.autoShipHint} checked={values.auto_ship} onCheckedChange={(v) => set("auto_ship", v)} />
      <Field label={s.notes} htmlFor="carrier-notes">
        <Textarea id="carrier-notes" maxLength={200} placeholder={s.notesPlaceholder} value={values.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {ar.common.cancel}
        </Button>
        <Button loading={busy} onClick={() => void save()}>
          {ar.common.save}
        </Button>
      </div>
    </div>
  );
}

/** The store's pickup address and parcel details, for carriers that need them (J&T). */
function SenderFields({ carrier, values, set }: { carrier: Carrier; values: CarrierSettings; set: <K extends keyof CarrierSettings>(key: K, value: CarrierSettings[K]) => void }) {
  const s = t.settingsDrawer;
  const governorates = useShipping().data?.governorates ?? [];
  const areas = useCarrierDistricts(carrier.key, values.sender_governorate ?? "");
  const options = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((k) => ({ value: k, label: labels[k] }));

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-semibold">{s.sender}</legend>
      <p className="text-xs text-ink-3">{s.senderHint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={s.senderName} htmlFor="sender-name">
          <Input id="sender-name" maxLength={50} value={values.sender_name ?? ""} onChange={(e) => set("sender_name", e.target.value)} />
        </Field>
        <Field label={s.senderPhone} hint={s.senderPhoneHint} htmlFor="sender-phone">
          <Input id="sender-phone" dir="ltr" inputMode="tel" maxLength={11} value={values.sender_phone ?? ""} onChange={(e) => set("sender_phone", e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label={s.senderGovernorate}>
          <Select
            value={values.sender_governorate ?? ""}
            onValueChange={(v) => (set("sender_governorate", v || null), set("sender_area", null))}
            options={governorates.map((g) => ({ value: g, label: g }))}
            aria-label={s.senderGovernorate}
          />
        </Field>
        <Field label={s.senderArea}>
          {areas.isError ? (
            <Alert tone="warning">{errorMessage(areas.error)}</Alert>
          ) : (
            <Select
              value={values.sender_area ?? ""}
              onValueChange={(v) => set("sender_area", v || null)}
              placeholder={values.sender_governorate ? undefined : s.senderAreaPick}
              disabled={!values.sender_governorate || areas.isPending}
              searchable
              options={(areas.data ?? []).map((a) => ({ value: a.id, label: a.name }))}
              aria-label={s.senderArea}
            />
          )}
        </Field>
      </div>
      <Field label={s.senderStreet} htmlFor="sender-street">
        <Input id="sender-street" maxLength={200} value={values.sender_street ?? ""} onChange={(e) => set("sender_street", e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={s.serviceType}>
          <Select value={values.service_type} onValueChange={(v) => set("service_type", v as CarrierSettings["service_type"])} options={options(s.serviceTypes)} aria-label={s.serviceType} />
        </Field>
        <Field label={s.goodsType}>
          <Select value={values.goods_type} onValueChange={(v) => set("goods_type", v)} options={options(s.goodsTypes)} aria-label={s.goodsType} />
        </Field>
        <Field label={s.weight} htmlFor="sender-weight">
          <Input id="sender-weight" dir="ltr" inputMode="decimal" value={values.weight} onChange={(e) => set("weight", e.target.value)} />
        </Field>
      </div>
    </fieldset>
  );
}

/** Today in Cairo (YYYY-MM-DD), plus some days. */
function cairoDay(plus = 0): string {
  const d = new Date(Date.now() + plus * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function PickupDialog({ carrier, onClose }: { carrier: Carrier | null; onClose: () => void }) {
  const p = t.pickupDialog;
  const [date, setDate] = React.useState(cairoDay(1));
  const [parcels, setParcels] = React.useState("1");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    if (!carrier) return;
    setBusy(true);
    setError(null);
    try {
      await requestPickup(carrier.key, { date, parcels: Number(parcels) || 1, notes: notes.trim() || null });
      toast.success(p.done);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={carrier !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader title={carrier ? p.title(carrier.name) : ""} />
        <DialogBody className="flex flex-col gap-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label={p.date} htmlFor="pickup-date" required>
            <Input id="pickup-date" type="date" dir="ltr" min={cairoDay()} max={cairoDay(14)} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={p.parcels} htmlFor="pickup-parcels" required>
            <Input id="pickup-parcels" type="number" dir="ltr" min={1} max={500} value={parcels} onChange={(e) => setParcels(e.target.value)} />
          </Field>
          <Field label={p.notes} htmlFor="pickup-notes">
            <Input id="pickup-notes" maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {ar.common.cancel}
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            {p.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
