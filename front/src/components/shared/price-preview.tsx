"use client";

import { Calculator } from "lucide-react";
import { useState } from "react";
import { FormField } from "@/components/forms/form-field";
import { DateTimeField } from "@/components/forms/datetime-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { fromCairoInputValue } from "@/lib/dates";
import { normalizePhone } from "@/lib/format/phone";
import { formatPrice } from "@/lib/price";
import { useProducts } from "@/lib/products/api";
import { previewPrice } from "@/lib/promotions/api";
import type { Product, Quote } from "@/lib/types";
import { ar } from "@/messages/ar";

const t = ar.pricePreview;

/** Dashboard price simulator: same PriceCalculator as real orders, with an optional simulated time. */
export function PricePreview() {
  const products = useProducts({ per_page: 100 });
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [options, setOptions] = useState<Record<string, string>>({});
  const [code, setCode] = useState("");
  const [at, setAt] = useState("");
  const [phone, setPhone] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const product = useQuery({
    queryKey: ["products", Number(productId)],
    queryFn: ({ signal }) => api<Product>(`/dashboard/products/${productId}`, { signal }),
    enabled: productId !== "",
  });

  async function calculate() {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const selected = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]));
      setQuote(
        await previewPrice({
          product_id: Number(productId),
          quantity: Number(quantity) || 1,
          options: selected,
          code: code.trim() || null,
          at: fromCairoInputValue(at),
          phone: phone.trim() ? normalizePhone(phone) ?? phone : null,
        }),
      );
    } catch (err) {
      setQuote(null);
      const first = isApiError(err) ? Object.values(err.errors)[0]?.[0] : undefined;
      setError(first ?? errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="size-5 text-primary" aria-hidden />
          {t.title}
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <FormField label={t.product} htmlFor="pp-product">
            <Select
              id="pp-product"
              value={productId}
              placeholder={t.chooseProduct}
              onChange={(event) => {
                setProductId(event.target.value);
                setOptions({});
                setQuote(null);
              }}
              options={(products.data?.data ?? []).map((p) => ({ value: String(p.id), label: `${p.name} — ${formatPrice(p.price)}` }))}
            />
          </FormField>
          {product.data?.options?.map((option) => (
            <FormField key={option.id} label={option.name} htmlFor={`pp-opt-${option.id}`} required={option.is_required}>
              <Select
                id={`pp-opt-${option.id}`}
                value={options[option.id] ?? ""}
                placeholder="—"
                onChange={(event) => setOptions((current) => ({ ...current, [option.id]: event.target.value }))}
                options={option.values.filter((v) => v.is_active).map((v) => ({ value: String(v.id), label: v.price_delta ? `${v.label} (+${formatPrice(v.price_delta)})` : v.label }))}
              />
            </FormField>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t.quantity} htmlFor="pp-qty">
              <Input id="pp-qty" type="number" min={1} max={20} dir="ltr" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </FormField>
            <FormField label={t.code} htmlFor="pp-code">
              <Input id="pp-code" dir="ltr" className="uppercase" value={code} onChange={(event) => setCode(event.target.value)} />
            </FormField>
          </div>
          <FormField label={t.at} htmlFor="pp-at">
            <DateTimeField id="pp-at" value={at} onChange={setAt} emptyLabel={t.atHint} />
          </FormField>
          <FormField label={t.phone} htmlFor="pp-phone" optional>
            <Input id="pp-phone" type="tel" dir="ltr" className="text-start" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </FormField>
          <Button type="button" onClick={calculate} loading={loading} disabled={!productId}>
            {t.calculate}
          </Button>
        </div>

        <div aria-live="polite">
          {error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          {quote ? <QuoteBreakdown quote={quote} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function QuoteBreakdown({ quote }: { quote: Quote }) {
  const row = (label: string, value: string, className?: string) => (
    <div className={`flex items-center justify-between gap-3 py-2 ${className ?? ""}`}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );

  return (
    <dl className="divide-y rounded-xl border bg-muted/30 px-4">
      {row(t.unit, `${formatPrice(quote.unit_price)} × ${quote.quantity}`)}
      {row(t.base, formatPrice(quote.base_subtotal))}
      {quote.offer ? row(`${t.offer}: ${quote.offer.name}`, `− ${formatPrice(quote.offer.discount)}`, "text-success") : row(t.offer, t.noOffer)}
      {row(t.afterOffer, formatPrice(quote.subtotal_after_offer))}
      {quote.code ? row(`${t.codeDiscount} (${quote.code.code})`, `− ${formatPrice(quote.code.discount)}`, "text-success") : null}
      {quote.code_error ? <p className="py-2 text-sm text-destructive">{quote.code_error}</p> : null}
      {row(t.total, formatPrice(quote.total), "text-lg")}
    </dl>
  );
}
