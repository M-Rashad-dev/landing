"use client";

import { Check, CheckCircle2, Clock, Copy, Download, ExternalLink, FileUp, Loader2, Paperclip, X, XCircle } from "lucide-react";
import * as React from "react";
import { formatDateTime, formatMoney } from "@/lib/format";
import { ImageRejected, prepareImage } from "@/lib/media/compress";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { pick, type MediaUrls } from "./design";

const t = ar.storefront.pay;
const MAX_BYTES = 10 * 1024 * 1024;

export type PayMethod = { id: number; kind: "instapay" | "wallet" | "bank" | "link"; name: string; account: string | null; link: string | null; instructions: string | null };
export type PayInfo = {
  order_number: number;
  total: number;
  status: "awaiting" | "paid" | "cancelled";
  payment_status: "unpaid" | "review" | "paid" | null;
  chosen_method_id: number | null;
  methods: PayMethod[];
  receipts: Array<{ status: "pending" | "approved" | "rejected"; method: string; reject_reason: string | null; created_at: string }>;
  can_send: boolean;
  cancel_at: string | null;
  store: { brand_name: string; colors: Record<string, string>; logo: { urls: MediaUrls } | null } | null;
  track_url: string;
  /** Digital products bought (once paid): downloads, codes, the link, a service's state. */
  deliveries?: Delivery[];
};

export type Delivery = {
  product: string | null;
  type: "files" | "codes" | "links" | "services";
  status: "pending" | "delivered";
  message: string | null;
  files: Array<{ id: number; name: string; size: number; left: number | null; url: string }>;
  codes: string[];
  link: { url: string; left: number | null } | null;
};

type Load = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; info: PayInfo };

/**
 * The pay page of a prepaid order, the same for every store and landing page: the total, the store's ways to pay
 * (copy the number, open the link), and the receipt upload; then where the receipt is (waiting, refused, accepted).
 */
export function PayView({ token }: { token: string }) {
  const [load, setLoad] = React.useState<Load>({ kind: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/public/payments/lookup", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ token }) })
      .then(async (r) => ({ ok: r.ok, status: r.status, json: (await r.json().catch(() => ({}))) as { data?: PayInfo } }))
      .then(({ ok, status, json }) => {
        if (cancelled) return;
        setLoad(ok && json.data ? { kind: "ready", info: json.data } : { kind: "error", message: status === 404 ? t.notFound : t.failed });
      })
      .catch(() => !cancelled && setLoad({ kind: "error", message: ar.storefront.checkout.errors.network }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (load.kind === "loading") {
    return (
      <Shell>
        <div className="flex justify-center py-16" role="status" aria-label={t.loading}>
          <Loader2 className="size-8 animate-spin text-neutral-400" aria-hidden />
        </div>
      </Shell>
    );
  }
  if (load.kind === "error") {
    return (
      <Shell>
        <p className="rounded-xl bg-red-50 p-4 text-center text-sm font-semibold text-red-700" role="alert">
          {load.message}
        </p>
      </Shell>
    );
  }
  return <Pay info={load.info} token={token} onChange={(info) => setLoad({ kind: "ready", info })} />;
}

function Shell({ info, children }: { info?: PayInfo; children: React.ReactNode }) {
  const primary = info?.store?.colors.primary ?? "#0b7a55";
  const onPrimary = info?.store?.colors.primary_foreground ?? "#ffffff";
  const logo = info?.store?.logo ? pick(info.store.logo.urls, "thumb") : null;
  return (
    <main dir="rtl" className="min-h-dvh bg-neutral-50 px-4 py-8 text-neutral-900" style={{ "--pay": primary, "--on-pay": onPrimary } as React.CSSProperties}>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
        {info?.store ? (
          <header className="flex items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- the store's logo from the media server */}
            {logo ? <img src={logo} alt="" className="size-10 rounded-lg object-contain" /> : null}
            <span className="text-lg font-extrabold">{info.store.brand_name}</span>
          </header>
        ) : null}
        {children}
      </div>
    </main>
  );
}

function Pay({ info, token, onChange }: { info: PayInfo; token: string; onChange: (info: PayInfo) => void }) {
  const last = info.receipts.at(-1);
  return (
    <Shell info={info}>
      <section className="flex flex-col items-center gap-1 rounded-2xl bg-white p-5 text-center shadow-sm">
        <h1 className="text-base font-bold text-neutral-600">{t.order(info.order_number)}</h1>
        <p className="text-3xl font-extrabold tabular-nums" style={{ color: "var(--pay)" }}>
          {formatMoney(info.total)}
        </p>
        {info.status === "awaiting" && info.cancel_at ? <p className="text-xs text-neutral-500">{t.payBefore(formatDateTime(info.cancel_at))}</p> : null}
      </section>

      {info.status === "paid" ? (
        <Banner tone="ok" icon={CheckCircle2} title={t.paidTitle}>
          {t.paidText}
        </Banner>
      ) : info.status === "cancelled" ? (
        <Banner tone="bad" icon={XCircle} title={t.cancelledTitle}>
          {t.cancelledText}
        </Banner>
      ) : last?.status === "pending" ? (
        <Banner tone="wait" icon={Clock} title={t.reviewTitle}>
          {t.reviewText}
        </Banner>
      ) : last?.status === "rejected" ? (
        <Banner tone="bad" icon={XCircle} title={t.rejectedTitle}>
          {t.rejectedText(last.reject_reason ?? "")}
        </Banner>
      ) : null}

      {info.can_send ? <PayForm info={info} token={token} onSent={onChange} /> : null}

      {info.deliveries && info.deliveries.length > 0 ? <Deliveries deliveries={info.deliveries} /> : null}

      <a href={info.track_url} className="text-center text-sm font-semibold text-neutral-600 underline-offset-4 hover:underline">
        {t.track}
      </a>
    </Shell>
  );
}

/** «منتجاتك»: each digital line with its files, codes, link, or the service's state. */
function Deliveries({ deliveries }: { deliveries: Delivery[] }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="font-extrabold">{t.yourProducts}</h2>
      {deliveries.map((d, i) => (
        <div key={i} className="flex flex-col gap-2 border-t border-neutral-100 pt-3 first:border-0 first:pt-0">
          <p className="font-bold">{d.product}</p>
          {d.status === "pending" ? (
            <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <Clock className="size-4 shrink-0" aria-hidden />
              {d.type === "services" ? t.serviceWaiting : t.codesWaiting}
            </p>
          ) : (
            <>
              {d.message ? <p className="whitespace-pre-line text-sm text-neutral-700">{d.message}</p> : null}
              {d.files.map((f) => (
                <a key={f.id} href={f.left === 0 ? undefined : f.url} aria-disabled={f.left === 0} className={cn("flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm", f.left === 0 ? "pointer-events-none opacity-50" : "hover:bg-neutral-50")}>
                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                    <Download className="size-4 shrink-0" style={{ color: "var(--pay)" }} aria-hidden />
                    <span className="truncate">{f.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-neutral-500">{f.left === null ? t.unlimited : f.left === 0 ? t.usedUp : t.left(f.left)}</span>
                </a>
              ))}
              {d.codes.map((c, j) => (
                <CodeBox key={j} code={c} />
              ))}
              {d.link ? (
                d.link.left === 0 ? (
                  <p className="text-sm text-neutral-500">{t.linkUsedUp}</p>
                ) : (
                  <a href={d.link.url} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-lg bg-(--pay) font-bold text-(--on-pay)">
                    <ExternalLink className="size-4" aria-hidden />
                    {t.openProduct}
                    {d.link.left !== null ? <span className="text-xs font-normal opacity-80">({t.left(d.link.left)})</span> : null}
                  </a>
                )
              ) : null}
            </>
          )}
        </div>
      ))}
    </section>
  );
}

function CodeBox({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2">
      <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-sm font-bold" dir="ltr">
        {code}
      </pre>
      <button
        type="button"
        className="flex shrink-0 items-center gap-1 text-xs font-semibold"
        style={{ color: "var(--pay)" }}
        onClick={() =>
          void navigator.clipboard
            .writeText(code)
            .then(() => (setCopied(true), window.setTimeout(() => setCopied(false), 2000)))
            .catch(() => undefined)
        }
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? t.copied : t.copy}
      </button>
    </div>
  );
}

function Banner({ tone, icon: Icon, title, children }: { tone: "ok" | "bad" | "wait"; icon: typeof Check; title: string; children: React.ReactNode }) {
  return (
    <div role="status" className={cn("flex gap-3 rounded-2xl p-4", tone === "ok" ? "bg-emerald-50 text-emerald-900" : tone === "bad" ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900")}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="font-bold">{title}</p>
        <p className="text-sm">{children}</p>
      </div>
    </div>
  );
}

function PayForm({ info, token, onSent }: { info: PayInfo; token: string; onSent: (info: PayInfo) => void }) {
  const [method, setMethod] = React.useState<number>(() => (info.methods.some((m) => m.id === info.chosen_method_id) ? info.chosen_method_id! : (info.methods[0]?.id ?? 0)));
  const [sender, setSender] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [preparing, setPreparing] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  const pickFile = async (raw: File) => {
    setError(null);
    if (raw.type === "application/pdf") {
      if (raw.size > MAX_BYTES) setError(t.tooBig);
      else setFile(raw);
      return;
    }
    setPreparing(true);
    try {
      setFile(await prepareImage(raw));
    } catch (e) {
      setError(e instanceof ImageRejected && e.reason === "size" ? t.tooBig : t.wrongType);
    } finally {
      setPreparing(false);
    }
  };

  const send = async () => {
    if (!file) {
      setError(t.receiptRequired);
      return;
    }
    setSending(true);
    setError(null);
    const form = new FormData();
    form.set("token", token);
    form.set("method_id", String(method));
    if (sender.trim()) form.set("sender_ref", sender.trim());
    form.set("receipt", file, file.name);
    try {
      const response = await fetch("/api/public/payments", { method: "POST", body: form, headers: { Accept: "application/json" } });
      const json = (await response.json().catch(() => ({}))) as { data?: PayInfo; message?: string; errors?: Record<string, string[]> };
      if (response.ok && json.data) {
        onSent(json.data);
        return;
      }
      setError(json.errors?.receipt?.[0] ?? json.errors?.method_id?.[0] ?? json.message ?? (response.status === 429 ? t.tooMany : t.failed));
    } catch {
      setError(ar.storefront.checkout.errors.network);
    } finally {
      setSending(false);
    }
  };

  const chosen = info.methods.find((m) => m.id === method);

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="font-extrabold">{t.step1}</h2>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label={t.step1}>
        {info.methods.map((m) => {
          const on = m.id === method;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setMethod(m.id)}
              className={cn("flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-start transition", on ? "border-(--pay) bg-neutral-50" : "border-neutral-200 hover:border-neutral-300")}
            >
              <span className="flex flex-col">
                <span className="font-bold">{m.name}</span>
                <span className="text-xs text-neutral-500">{t.kinds[m.kind]}</span>
              </span>
              <span className={cn("flex size-5 items-center justify-center rounded-full border-2", on ? "border-(--pay) bg-(--pay) text-(--on-pay)" : "border-neutral-300")}>{on ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}</span>
            </button>
          );
        })}
      </div>

      {chosen ? <MethodDetails method={chosen} total={info.total} /> : null}

      <h2 className="mt-1 font-extrabold">{t.step2}</h2>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">{t.sender}</span>
        <input value={sender} onChange={(e) => setSender(e.target.value)} maxLength={80} placeholder={t.senderPlaceholder} className="h-11 rounded-lg border border-neutral-300 px-3" />
      </label>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        aria-label={t.receipt}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pickFile(f);
        }}
      />
      {file ? (
        <span className="flex h-12 items-center gap-2 rounded-lg border border-neutral-300 px-3 text-sm">
          <Paperclip className="size-4 shrink-0 text-neutral-500" aria-hidden />
          <span className="truncate" dir="ltr">
            {file.name}
          </span>
          <button type="button" onClick={() => setFile(null)} className="ms-auto rounded p-1 text-neutral-500 hover:text-neutral-900" aria-label={t.removeReceipt}>
            <X className="size-4" aria-hidden />
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={preparing} className="flex h-12 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 text-sm font-semibold hover:border-neutral-400 disabled:opacity-60">
          {preparing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />}
          {t.receipt}
        </button>
      )}
      {error ? (
        <p className="text-sm font-semibold text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" onClick={() => void send()} disabled={sending || preparing} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-(--pay) font-bold text-(--on-pay) disabled:opacity-60">
        {sending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
        {t.send}
      </button>
    </section>
  );
}

function MethodDetails({ method, total }: { method: PayMethod; total: number }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    if (!method.account) return;
    try {
      await navigator.clipboard.writeText(method.account);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the number is on screen to copy by hand.
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-neutral-50 p-4 text-sm">
      <p>{t.sendAmount(formatMoney(total))}</p>
      {method.account ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
          <span className="font-mono text-base font-bold" dir="ltr">
            {method.account}
          </span>
          <button type="button" onClick={() => void copy()} className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--pay)" }}>
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? t.copied : t.copy}
          </button>
        </div>
      ) : null}
      {method.link ? (
        <a href={method.link} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-lg bg-(--pay) font-bold text-(--on-pay)">
          <ExternalLink className="size-4" aria-hidden />
          {method.kind === "link" ? t.payOnline : t.openLink}
        </a>
      ) : null}
      {method.instructions ? <p className="whitespace-pre-line text-neutral-700">{method.instructions}</p> : null}
    </div>
  );
}
