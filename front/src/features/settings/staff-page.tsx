"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, Send, Trash2, UserPlus, Users } from "lucide-react";
import * as React from "react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/overlay";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { api } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { useCan, usePlanLimit } from "@/lib/auth/session-context";
import { formatDateTime } from "@/lib/format";
import { ar } from "@/messages/ar";

const t = ar.staff;

export type StaffMember = { id: number; name: string; email: string; phone: string; state: "invited" | "active" | "stopped" | "locked"; permissions: string[]; invited_at: string | null; last_login_at: string | null };
export type PermissionPage = { page: string; label: string; group: string; actions: Array<{ key: string; label: string; grantable: boolean }> };

const TONES: Record<StaffMember["state"], Tone> = { invited: "attention", active: "success", stopped: "neutral", locked: "warning" };

/** Quick ticks for common jobs (they only fill the boxes; the person can change any of them). */
export const PRESETS: Record<keyof typeof t.presets, string[]> = {
  callCenter: ["home.view", "orders.view", "orders.confirm", "orders.status", "orders.update", "customers.view", "abandoned.view", "abandoned.update"],
  shipping: ["orders.view", "orders.status", "orders.ship", "shipping.view"],
  products: ["products.view", "products.create", "products.update", "products.import", "products.digital", "categories.view", "categories.create", "categories.update", "reviews.view", "reviews.update"],
  marketing: ["offers.view", "offers.create", "offers.update", "coupons.view", "coupons.create", "coupons.update", "upsells.view", "upsells.create", "upsells.update", "landings.view", "landings.create", "landings.update", "landings.publish", "analytics.view"],
};

/** «الإعدادات ← الموظفين»: who works on the store and what each one may see and do. */
export function StaffPage() {
  const client = useQueryClient();
  const can = useCan();
  const limit = usePlanLimit("staff_accounts");
  const list = useQuery({ queryKey: ["staff"], queryFn: () => api<StaffMember[]>("/dashboard/staff") });
  const catalog = useQuery({ queryKey: ["staff-permissions"], queryFn: () => api<PermissionPage[]>("/dashboard/staff/permissions") });
  const [editing, setEditing] = React.useState<StaffMember | "new" | null>(null);
  const [removing, setRemoving] = React.useState<StaffMember | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (list.isPending || catalog.isPending) return <Skeleton className="h-80 max-w-4xl rounded-xl" />;
  if (list.isError || catalog.isError) return <ErrorState onRetry={() => (void list.refetch(), void catalog.refetch())} message={errorMessage(list.error ?? catalog.error)} />;
  const people = list.data;
  const refresh = () => client.invalidateQueries({ queryKey: ["staff"] });

  const act = async (path: string, method: "POST" | "DELETE", done: string) => {
    setBusy(true);
    try {
      await api(path, { method });
      toast.success(done);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <p className="text-sm text-ink-2">{t.description}</p>
      <Panel>
        <PanelHeader
          title={t.title}
          description={t.seats(people.length, limit)}
          actions={
            can("staff.create") ? (
              <Button size="sm" onClick={() => setEditing("new")}>
                <UserPlus />
                {t.add}
              </Button>
            ) : undefined
          }
        />
        {people.length === 0 ? (
          <div className="p-5">
            <EmptyState compact icon={Users} title={t.empty} description={t.emptyText} />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {people.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {p.name}
                    <Badge size="sm" tone={TONES[p.state]}>
                      {t.states[p.state]}
                    </Badge>
                  </span>
                  <span className="block truncate text-xs text-ink-3" dir="ltr">
                    {p.email} · {p.phone}
                  </span>
                  <span className="block text-xs text-ink-3">
                    {t.permissionsCount(p.permissions.length)} · {p.last_login_at ? t.lastLogin(formatDateTime(p.last_login_at)) : t.neverLoggedIn}
                  </span>
                </span>
                <Menu>
                  <MenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={ar.common.actions} disabled={busy}>
                      <MoreHorizontal />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    {can("staff.update") ? <MenuItem onSelect={() => setEditing(p)}>{t.edit}</MenuItem> : null}
                    {can("staff.update") ? <MenuItem onSelect={() => void act(`/dashboard/staff/${p.id}/toggle`, "POST", p.state === "stopped" ? t.resumed : t.stopped)}>{p.state === "stopped" ? t.resume : t.stop}</MenuItem> : null}
                    {can("staff.update") && p.state === "invited" ? (
                      <MenuItem onSelect={() => void act(`/dashboard/staff/${p.id}/resend`, "POST", t.resent)}>
                        <Send />
                        {t.resend}
                      </MenuItem>
                    ) : null}
                    {can("staff.delete") ? (
                      <MenuItem destructive onSelect={() => setRemoving(p)}>
                        <Trash2 />
                        {t.remove}
                      </MenuItem>
                    ) : null}
                  </MenuContent>
                </Menu>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <StaffDialog key={editing === null ? "closed" : editing === "new" ? "new" : editing.id} member={editing} catalog={catalog.data} onClose={() => setEditing(null)} onSaved={() => (setEditing(null), void refresh())} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t.removeTitle}
        description={t.removeText}
        confirmLabel={t.remove}
        destructive
        loading={busy}
        onConfirm={() => removing && void act(`/dashboard/staff/${removing.id}`, "DELETE", t.removed).then(() => setRemoving(null))}
      />
    </div>
  );
}

function StaffDialog({ member, catalog, onClose, onSaved }: { member: StaffMember | "new" | null; catalog: PermissionPage[]; onClose: () => void; onSaved: () => void }) {
  const editing = member !== null && member !== "new" ? member : null;
  const [name, setName] = React.useState(editing?.name ?? "");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [chosen, setChosen] = React.useState<Set<string>>(() => new Set(editing?.permissions ?? []));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const grantable = React.useMemo(() => catalog.flatMap((p) => p.actions.filter((a) => a.grantable).map((a) => a.key)), [catalog]);
  const groups = React.useMemo(() => [...new Set(catalog.map((p) => p.group))], [catalog]);

  const toggle = (keys: string[], on: boolean) =>
    setChosen((c) => {
      const next = new Set(c);
      for (const k of keys) {
        if (!grantable.includes(k)) continue;
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });

  const save = async () => {
    setErrors({});
    setSaving(true);
    try {
      const permissions = [...chosen];
      if (editing) await api(`/dashboard/staff/${editing.id}`, { method: "PUT", body: { name, permissions } });
      else await api("/dashboard/staff", { method: "POST", body: { name, email, phone, permissions } });
      toast.success(editing ? t.saved : t.added);
      onSaved();
    } catch (error) {
      if (isApiError(error)) setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, v]) => [k, v[0] ?? ""])));
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={member !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader title={editing ? t.editTitle(editing.name) : t.addTitle} />
        <DialogBody className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.name} htmlFor="st-name" error={errors.name}>
              <Input id="st-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </Field>
            {!editing ? (
              <>
                <Field label={t.email} htmlFor="st-email" hint={t.emailHint} error={errors.email}>
                  <Input id="st-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label={t.phone} htmlFor="st-phone" error={errors.phone ?? errors.phone_e164}>
                  <Input id="st-phone" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01012345678" />
                </Field>
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{t.permissions}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => toggle(grantable, chosen.size < grantable.length)}>
              {t.all}
            </Button>
            {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((k) => (
              <Button key={k} type="button" size="sm" variant="ghost" onClick={() => toggle(PRESETS[k], true)}>
                <Plus />
                {t.presets[k]}
              </Button>
            ))}
          </div>
          {errors.permissions ? <p className="text-xs text-danger">{errors.permissions}</p> : null}

          <div className="flex max-h-[45vh] flex-col gap-4 overflow-y-auto pe-1">
            {groups.map((group) => (
              <div key={group} className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-ink-3">{group}</p>
                {catalog
                  .filter((p) => p.group === group)
                  .map((page) => {
                    const keys = page.actions.map((a) => a.key);
                    const all = keys.every((k) => chosen.has(k));
                    return (
                      <div key={page.page} className="rounded-lg border border-border p-3">
                        <label className="flex items-center gap-2 text-sm font-semibold">
                          <Checkbox checked={all} onCheckedChange={(v) => toggle(keys, v === true)} aria-label={page.label} />
                          {page.label}
                        </label>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 ps-6">
                          {page.actions.map((a) => (
                            <label key={a.key} className="flex items-center gap-1.5 text-xs text-ink-2" title={a.grantable ? undefined : t.notYours}>
                              <Checkbox checked={chosen.has(a.key)} disabled={!a.grantable} onCheckedChange={(v) => toggle([a.key], v === true)} aria-label={`${page.label}: ${a.label}`} />
                              {a.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {ar.common.cancel}
          </Button>
          <Button loading={saving} onClick={() => void save()}>
            {ar.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
