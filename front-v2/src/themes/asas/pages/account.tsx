"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ImageOff, KeyRound, Loader2, LogOut, MapPin, Package, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatDateTime, formatMoney } from "@/lib/format";
import { formatPhoneLocal, normalizePhone } from "@/lib/phone";
import {
  accountKeys,
  deleteAddress,
  saveAddress,
  sendCode,
  signOut,
  updateName,
  useAccount,
  useMyOrder,
  useMyOrders,
  verifyCode,
  writeReview,
  type Address,
  type OrderDetail,
} from "@/lib/store/account";
import { GOVERNORATES } from "@/lib/store/governorates";
import type { TrackStage } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { StoreLink } from "../context";
import { Breadcrumb, Container, Empty, FormField, inputClass, StarInput, Stars } from "../parts";
import { pick } from "../types";

const t = ar.storefront.account;
const STAGES = ar.storefront.track.stages;

/** Only paths inside this store (a "next" from the link must never leave it). */
function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

/* ---------- Sign in ---------- */

export function SignInView({ next }: { next: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [phone, setPhone] = React.useState("");
  const [step, setStep] = React.useState<"phone" | "code">("phone");
  const [code, setCode] = React.useState("");
  const [shown, setShown] = React.useState<string | null>(null);
  const [wait, setWait] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const request = async () => {
    setError(null);
    if (!normalizePhone(phone)) {
      setError(ar.storefront.checkout.errors.phone);
      return;
    }
    setBusy(true);
    try {
      const sent = await sendCode(phone);
      setShown(sent.code);
      setWait(sent.resend_in);
      setCode("");
      setStep("code");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError(t.codeError);
      return;
    }
    setBusy(true);
    try {
      const { customer } = await verifyCode(phone, code);
      queryClient.setQueryData(accountKeys.me, customer);
      router.replace(safeNext(next));
    } catch (err) {
      setError(isApiError(err) && err.errors.code?.[0] ? err.errors.code[0] : errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Container className="flex justify-center py-10">
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border p-5 @3xl:p-7">
        <span className="flex size-12 items-center justify-center self-center rounded-full bg-(--as-soft) as-primary">
          <KeyRound className="size-6" aria-hidden />
        </span>
        {step === "phone" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void request();
            }}
            noValidate
            className="flex flex-col gap-4"
          >
            <div className="text-center">
              <h1 className="as-xl font-extrabold">{t.signInTitle}</h1>
              <p className="as-sm as-muted mt-1">{t.signInHint}</p>
            </div>
            <FormField id="si-phone" label={t.phone} error={error}>
              <input id="si-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className={cn(inputClass, "text-end")} aria-invalid={error ? true : undefined} autoFocus />
            </FormField>
            <button type="submit" disabled={busy} className="as-btn as-base h-11 disabled:opacity-60">
              {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              {busy ? t.sending : t.sendCode}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} noValidate className="flex flex-col gap-4">
            <div className="text-center">
              <h1 className="as-xl font-extrabold">{t.codeTitle}</h1>
              <p className="as-sm as-muted mt-1">{t.codeSentTo(formatPhoneLocal(normalizePhone(phone)))}</p>
            </div>
            {shown ? (
              <div className="rounded-xl border-2 border-dashed border-(--as-secondary) bg-(--as-soft) p-3 text-center">
                <p className="as-xs font-bold">{t.screenCode}</p>
                <p className="as-2xl font-extrabold tracking-[0.3em] as-primary" dir="ltr" data-testid="screen-code">
                  {shown}
                </p>
                <p className="as-xs as-muted">{t.screenNote}</p>
              </div>
            ) : null}
            <FormField id="si-code" label={t.code} error={error}>
              <input
                id="si-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={cn(inputClass, "text-center text-2xl tracking-[0.4em]")}
                aria-invalid={error ? true : undefined}
                autoFocus
              />
            </FormField>
            <button type="submit" disabled={busy} className="as-btn as-base h-11 disabled:opacity-60">
              {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              {busy ? t.verifying : t.verify}
            </button>
            <div className="as-sm flex items-center justify-between">
              <button type="button" onClick={() => setStep("phone")} className="font-semibold as-primary hover:underline">
                {t.changePhone}
              </button>
              {wait > 0 ? (
                <span className="as-xs as-muted">{t.resendIn(wait)}</span>
              ) : (
                <button type="button" onClick={() => void request()} disabled={busy} className="font-semibold as-primary hover:underline">
                  {t.resend}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </Container>
  );
}

/** The signed-in customer, or a redirect to the sign-in page. */
function useSignedIn(path: string) {
  const router = useRouter();
  const account = useAccount();
  React.useEffect(() => {
    if (account.data === null) router.replace(`/account/login?next=${encodeURIComponent(path)}`);
  }, [account.data, path, router]);
  return account;
}

/* ---------- حسابي ---------- */

type Tab = "orders" | "addresses" | "profile";

export function AccountView() {
  const account = useSignedIn("/account");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<Tab>("orders");

  if (!account.data) return <Container className="min-h-[50vh] py-8">{account.isError ? <p className="as-sm text-red-600">{t.failed}</p> : <div className="h-40 animate-pulse rounded-2xl bg-(--as-soft)" />}</Container>;
  const me = account.data;

  const leave = async () => {
    await signOut().catch(() => undefined);
    queryClient.setQueryData(accountKeys.me, null);
    queryClient.removeQueries({ queryKey: ["store-account", "orders"] });
    router.replace("/");
  };

  return (
    <Container className="flex flex-col gap-5 py-6 @3xl:py-8">
      <Breadcrumb items={[{ name: t.title }]} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="as-2xl font-extrabold">{t.welcome(me.name)}</h1>
          <p className="as-sm as-muted" dir="ltr">
            {formatPhoneLocal(me.phone)}
          </p>
        </div>
        <button type="button" onClick={leave} className="as-sm flex items-center gap-1.5 rounded-lg border px-3 py-2 font-semibold hover:bg-(--as-soft)">
          <LogOut className="size-4" aria-hidden />
          {t.signOut}
        </button>
      </div>
      <div className="flex gap-1 border-b" role="tablist">
        {(["orders", "addresses", "profile"] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn("as-sm -mb-px border-b-2 px-4 py-2.5 font-bold", tab === key ? "border-(--as-primary) as-primary" : "border-transparent as-muted")}>
            {t.tabs[key]}
          </button>
        ))}
      </div>
      {tab === "orders" ? <OrdersList /> : tab === "addresses" ? <AddressBook addresses={me.addresses} /> : <ProfileForm name={me.name ?? ""} phone={me.phone} />}
    </Container>
  );
}

function StageBadge({ stage }: { stage: TrackStage }) {
  const tone = stage === "delivered" ? "bg-emerald-100 text-emerald-800" : stage === "cancelled" || stage === "returned" ? "bg-red-100 text-red-700" : "bg-(--as-soft) as-primary";
  return <span className={cn("as-xs rounded-full px-2.5 py-0.5 font-bold", tone)}>{STAGES[stage]}</span>;
}

function OrdersList() {
  const [page, setPage] = React.useState(1);
  const orders = useMyOrders(page);
  if (orders.isPending) return <div className="h-40 animate-pulse rounded-2xl bg-(--as-soft)" aria-busy />;
  if (orders.isError) return <p className="as-sm text-red-600">{t.failed}</p>;
  if (orders.data.data.length === 0) {
    return (
      <Empty
        icon={<Package className="size-6" />}
        title={t.noOrders}
        text={t.noOrdersHint}
        action={
          <StoreLink href="/products" className="as-btn as-sm">
            {ar.storefront.cartPage.shop}
          </StoreLink>
        }
      />
    );
  }
  const { meta } = orders.data;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {orders.data.data.map((o) => (
          <li key={o.order_number}>
            <StoreLink href={`/account/orders/${o.order_number}`} className="flex items-center gap-3 rounded-xl border p-4 hover:bg-(--as-soft)">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="as-base font-bold">{t.order(o.order_number)}</span>
                  <StageBadge stage={o.stage} />
                </div>
                <p className="as-xs as-muted truncate">{o.products.join("، ")}</p>
                <p className="as-xs as-muted">
                  {formatDateTime(o.created_at)} · {t.itemsCount(o.items_count)}
                </p>
              </div>
              <span className="as-base font-bold">{formatMoney(o.total)}</span>
              <ChevronLeft className="size-4 as-muted" aria-hidden />
            </StoreLink>
          </li>
        ))}
      </ul>
      {meta.last_page > 1 ? (
        <div className="as-sm flex items-center justify-center gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">
            {ar.storefront.previous}
          </button>
          <span className="as-muted">{ar.storefront.list.page(meta.current_page, meta.last_page)}</span>
          <button type="button" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">
            {ar.storefront.next}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AddressBook({ addresses }: { addresses: Address[] }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState<Address | "new" | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: accountKeys.me });

  if (editing) {
    return (
      <AddressForm
        address={editing === "new" ? null : editing}
        onDone={() => {
          setEditing(null);
          void refresh();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {addresses.length === 0 ? <Empty icon={<MapPin className="size-6" />} title={t.noAddresses} text={t.noAddressesHint} /> : null}
      <ul className="grid gap-3 @3xl:grid-cols-2">
        {addresses.map((a) => (
          <li key={a.id} className={cn("flex flex-col gap-1 rounded-xl border p-4", a.is_default && "border-(--as-primary)")}>
            <div className="flex items-center gap-2">
              <span className="as-sm font-bold">{a.name}</span>
              {a.is_default ? <span className="as-xs rounded-full bg-(--as-soft) px-2 font-bold as-primary">{t.default}</span> : null}
            </div>
            <p className="as-sm as-muted">{[a.address, a.city, a.governorate].filter(Boolean).join("، ")}</p>
            <div className="as-sm mt-2 flex gap-3">
              <button type="button" onClick={() => setEditing(a)} className="flex items-center gap-1 font-semibold as-primary hover:underline">
                <Pencil className="size-3.5" aria-hidden />
                {t.edit}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(t.deleteConfirm)) return;
                  await deleteAddress(a.id).catch(() => undefined);
                  void refresh();
                }}
                className="flex items-center gap-1 font-semibold text-red-600 hover:underline"
              >
                <Trash2 className="size-3.5" aria-hidden />
                {t.delete}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {addresses.length < 10 ? (
        <button type="button" onClick={() => setEditing("new")} className="as-sm flex items-center gap-1.5 self-start rounded-lg border px-4 py-2 font-semibold hover:bg-(--as-soft)">
          <Plus className="size-4" aria-hidden />
          {t.addAddress}
        </button>
      ) : null}
    </div>
  );
}

function AddressForm({ address, onDone, onCancel }: { address: Address | null; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = React.useState({ name: address?.name ?? "", governorate: address?.governorate ?? "", city: address?.city ?? "", address: address?.address ?? "", is_default: address?.is_default ?? false });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await saveAddress({ ...form, city: form.city.trim() || null }, address?.id);
      onDone();
    } catch (err) {
      const fields: Record<string, string> = {};
      if (isApiError(err)) for (const [k, v] of Object.entries(err.errors)) fields[k] = v[0] ?? "";
      setErrors(Object.keys(fields).length ? fields : { form: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-2xl border p-4 @3xl:p-5">
      <h2 className="as-lg font-bold">{address ? t.editAddress : t.addAddress}</h2>
      <div className="grid gap-4 @3xl:grid-cols-2">
        <FormField id="ad-name" label={t.addressName} error={errors.name}>
          <input id="ad-name" maxLength={80} value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
        </FormField>
        <FormField id="ad-governorate" label={ar.storefront.checkout.governorate} error={errors.governorate}>
          <select id="ad-governorate" value={form.governorate} onChange={(e) => set({ governorate: e.target.value })} className={inputClass}>
            <option value="">{ar.storefront.checkout.chooseGovernorate}</option>
            {GOVERNORATES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="ad-city" label={ar.storefront.checkout.city} error={errors.city} optional>
          <input id="ad-city" maxLength={100} value={form.city} onChange={(e) => set({ city: e.target.value })} className={inputClass} />
        </FormField>
        <FormField id="ad-address" label={ar.storefront.checkout.address} error={errors.address}>
          <input id="ad-address" maxLength={300} value={form.address} onChange={(e) => set({ address: e.target.value })} className={inputClass} />
        </FormField>
      </div>
      <label className="as-sm flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={form.is_default} onChange={(e) => set({ is_default: e.target.checked })} className="size-4 accent-(--as-primary)" />
        {t.makeDefault}
      </label>
      {errors.form ? <p className="as-sm text-red-600">{errors.form}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="as-btn as-sm h-10 disabled:opacity-60">
          {t.save}
        </button>
        <button type="button" onClick={onCancel} className="as-sm h-10 rounded-lg border px-4 font-semibold">
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const queryClient = useQueryClient();
  const [value, setValue] = React.useState(name);
  const [state, setState] = React.useState<{ kind: "idle" | "busy" | "saved" } | { kind: "error"; message: string }>({ kind: "idle" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ kind: "busy" });
    try {
      queryClient.setQueryData(accountKeys.me, await updateName(value));
      setState({ kind: "saved" });
    } catch (err) {
      setState({ kind: "error", message: isApiError(err) && err.errors.name?.[0] ? err.errors.name[0] : errorMessage(err) });
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-4">
      <FormField id="pf-name" label={t.name} error={state.kind === "error" ? state.message : null}>
        <input id="pf-name" maxLength={80} value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
      </FormField>
      <FormField id="pf-phone" label={t.phone} hint={t.phoneFixed}>
        <input id="pf-phone" dir="ltr" value={formatPhoneLocal(phone)} readOnly className={cn(inputClass, "text-end opacity-70")} />
      </FormField>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={state.kind === "busy"} className="as-btn as-sm h-10 disabled:opacity-60">
          {t.save}
        </button>
        {state.kind === "saved" ? <span className="as-sm font-semibold as-primary">{t.saved}</span> : null}
      </div>
    </form>
  );
}

/* ---------- Order ---------- */

export function MyOrderView({ number }: { number: number }) {
  const account = useSignedIn(`/account/orders/${number}`);
  const order = useMyOrder(number);

  if (!account.data || order.isPending) return <Container className="min-h-[50vh] py-8"><div className="h-60 animate-pulse rounded-2xl bg-(--as-soft)" /></Container>;
  if (order.isError) {
    return (
      <Container className="py-8">
        <Empty
          icon={<Package className="size-6" />}
          title={ar.storefront.notFound.title}
          action={
            <StoreLink href="/account" className="as-btn as-sm">
              {t.backToOrders}
            </StoreLink>
          }
        />
      </Container>
    );
  }
  const o = order.data;
  return (
    <Container className="flex max-w-3xl flex-col gap-5 py-6 @3xl:py-8">
      <Breadcrumb items={[{ name: t.title, href: "/account" }, { name: t.order(o.order_number) }]} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="as-2xl font-extrabold">{t.order(o.order_number)}</h1>
        <StageBadge stage={o.stage} />
        <span className="as-xs as-muted ms-auto">{formatDateTime(o.created_at)}</span>
      </div>
      <Progress order={o} />
      <ul className="flex flex-col divide-y rounded-2xl border">
        {o.items.map((item, i) => (
          <OrderItemRow key={`${item.product_id}-${i}`} item={item} orderNumber={o.order_number} />
        ))}
      </ul>
      <div className="grid gap-4 @3xl:grid-cols-2">
        <div className="as-sm flex flex-col gap-1 rounded-xl bg-(--as-card) p-4">
          <p className="as-xs as-muted">{t.deliverTo}</p>
          <p className="font-semibold">{o.customer_name}</p>
          <p className="as-muted">{[o.address, o.city, o.governorate].filter(Boolean).join("، ")}</p>
          {o.shipping_company ? (
            <p className="as-muted">
              {ar.storefront.track.carrier}: {o.shipping_company}
              {o.tracking_number ? <span dir="ltr"> · {o.tracking_number}</span> : null}
            </p>
          ) : null}
        </div>
        <dl className="as-sm flex flex-col gap-1.5 rounded-xl bg-(--as-card) p-4">
          <div className="flex justify-between">
            <dt className="as-muted">{t.subtotal}</dt>
            <dd>{formatMoney(o.subtotal)}</dd>
          </div>
          {o.discount > 0 ? (
            <div className="flex justify-between as-primary">
              <dt>{t.discount}</dt>
              <dd>−{formatMoney(o.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="as-muted">{t.shipping}</dt>
            <dd>{o.shipping_fee > 0 ? formatMoney(o.shipping_fee) : ar.storefront.checkout.free}</dd>
          </div>
          <div className="as-base flex justify-between border-t pt-1.5 font-extrabold">
            <dt>{t.total}</dt>
            <dd>{formatMoney(o.total)}</dd>
          </div>
        </dl>
      </div>
    </Container>
  );
}

function Progress({ order }: { order: OrderDetail }) {
  const steps: TrackStage[] = ["received", "confirmed", "shipped", "delivered"];
  if (order.stage === "returned" || order.stage === "cancelled") return null;
  const reached = steps.indexOf(order.stage);
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label={ar.storefront.track.title}>
      {steps.map((s, i) => (
        <li key={s} className="flex flex-col gap-1.5" aria-current={i === reached ? "step" : undefined}>
          <span className={cn("h-1.5 rounded-full", i <= reached ? "bg-(--as-primary)" : "bg-(--as-line)")} />
          <span className={cn("as-xs font-semibold", i > reached && "as-muted")}>{STAGES[s]}</span>
        </li>
      ))}
    </ol>
  );
}

function OrderItemRow({ item, orderNumber }: { item: OrderDetail["items"][number]; orderNumber: number }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [rating, setRating] = React.useState(item.review?.rating ?? 0);
  const [text, setText] = React.useState(item.review?.text ?? "");
  const [state, setState] = React.useState<{ kind: "idle" | "busy" | "saved" } | { kind: "error"; message: string }>({ kind: "idle" });
  const image = pick(item.image, "thumb");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      setState({ kind: "error", message: t.pickStars });
      return;
    }
    setState({ kind: "busy" });
    try {
      await writeReview({ product_id: item.product_id!, rating, text: text.trim() || null });
      setState({ kind: "saved" });
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: accountKeys.order(orderNumber) });
    } catch (err) {
      setState({ kind: "error", message: errorMessage(err) });
    }
  };

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex gap-3">
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-(--as-soft)">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- store images come from the media server
            <img src={image} alt="" className="size-full object-cover" />
          ) : (
            <ImageOff className="size-5 as-muted" aria-hidden />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {item.slug ? (
            <StoreLink href={`/products/${encodeURIComponent(item.slug)}`} className="as-sm font-semibold hover:underline">
              {item.name}
            </StoreLink>
          ) : (
            <span className="as-sm font-semibold">{item.name}</span>
          )}
          {item.options.length ? <span className="as-xs as-muted">{item.options.join("، ")}</span> : null}
          <span className="as-xs as-muted">
            × {item.quantity} {item.is_gift ? `· ${t.gift}` : ""}
          </span>
          {item.review && !open ? (
            <span className="as-xs flex items-center gap-1.5">
              {t.yourReview}: <Stars value={item.review.rating} size="size-3.5" />
            </span>
          ) : null}
        </div>
        <span className="as-sm font-bold">{item.is_gift ? t.gift : formatMoney(item.total)}</span>
      </div>
      {item.can_review && !open ? (
        <button type="button" onClick={() => setOpen(true)} className="as-sm flex items-center gap-1.5 self-start rounded-lg border px-3 py-1.5 font-semibold hover:bg-(--as-soft)">
          <Star className="size-4" aria-hidden />
          {item.review ? t.editReview : t.rate}
        </button>
      ) : null}
      {state.kind === "saved" && !open ? <p className="as-xs font-semibold as-primary">{t.reviewSaved}</p> : null}
      {open ? (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-xl bg-(--as-card) p-3">
          <StarInput value={rating} onChange={setRating} label={t.pickStars} />
          <FormField id={`rv-${item.product_id}`} label={t.reviewText} optional>
            <textarea id={`rv-${item.product_id}`} rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.reviewPlaceholder} className={cn(inputClass, "h-auto py-2")} />
          </FormField>
          {state.kind === "error" ? (
            <p className="as-xs font-semibold text-red-600" role="alert">
              {state.message}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="submit" disabled={state.kind === "busy"} className="as-btn as-sm h-9 disabled:opacity-60">
              {t.reviewSave}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="as-sm h-9 rounded-lg border px-3 font-semibold">
              {t.cancel}
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
