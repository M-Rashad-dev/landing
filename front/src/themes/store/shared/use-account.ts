"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { normalizePhone } from "@/lib/phone";
import { accountKeys, deleteAddress, saveAddress, sendCode, signOut, updateProfile, useAccount, verifyCode, type Address } from "@/lib/store/account";
import { currentCart } from "@/lib/store/cart";
import { syncCart } from "@/lib/store/events";
import { ar } from "@/messages/ar";

const t = ar.storefront.account;

/** Only paths inside this store (a "next" from the link must never leave it). */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

/** Signing in with the phone and a one-time code: two steps, a resend timer, then back to `next`. */
export function useSignIn(next: string | null) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [phone, setPhone] = React.useState("");
  const [step, setStep] = React.useState<"phone" | "code">("phone");
  const [code, setCode] = React.useState("");
  /** The code shown on the screen when no message channel works (the server decides). */
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

  const verify = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError(t.codeError);
      return;
    }
    setBusy(true);
    try {
      const { customer } = await verifyCode(phone, code);
      queryClient.setQueryData(accountKeys.me, customer);
      // A cart filled before signing in now belongs to this customer (abandoned carts).
      const cart = currentCart();
      if (cart.items.length > 0) syncCart(cart);
      router.replace(safeNext(next));
    } catch (err) {
      setError(isApiError(err) && err.errors.code?.[0] ? err.errors.code[0] : errorMessage(err));
      setBusy(false);
    }
  };

  return {
    phone,
    setPhone,
    step,
    changePhone: () => setStep("phone"),
    code,
    /** Keeps digits only, six at most. */
    setCode: (value: string) => setCode(value.replace(/\D/g, "").slice(0, 6)),
    shown,
    wait,
    error,
    busy,
    request,
    verify,
  };
}

/** The signed-in customer, or a redirect to the sign-in page (coming back to `path`). */
export function useSignedIn(path: string) {
  const router = useRouter();
  const account = useAccount();
  React.useEffect(() => {
    if (account.data === null) router.replace(`/account/login?next=${encodeURIComponent(path)}`);
  }, [account.data, path, router]);
  return account;
}

/** Signs out, forgets the customer's cached data and goes to the store home. */
export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return async () => {
    await signOut().catch(() => undefined);
    queryClient.setQueryData(accountKeys.me, null);
    queryClient.removeQueries({ queryKey: ["store-account", "orders"] });
    router.replace("/");
  };
}

/** Reloads the customer (addresses, profile) after a change. */
export function useRefreshAccount() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: accountKeys.me });
}

/** Deletes a saved address (a failure leaves the list as it is) and reloads the customer. */
export function useRemoveAddress() {
  const refresh = useRefreshAccount();
  return async (address: Address) => {
    await deleteAddress(address.id).catch(() => undefined);
    void refresh();
  };
}

/** Adding or editing a saved address: the values, the server's field errors, saving. */
export function useAddressForm(address: Address | null, onDone: () => void) {
  const [values, setValues] = React.useState({ name: address?.name ?? "", governorate: address?.governorate ?? "", city: address?.city ?? "", address: address?.address ?? "", is_default: address?.is_default ?? false });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      await saveAddress({ ...values, city: values.city.trim() || null }, address?.id);
      onDone();
    } catch (err) {
      const fields: Record<string, string> = {};
      if (isApiError(err)) for (const [k, v] of Object.entries(err.errors)) fields[k] = v[0] ?? "";
      setErrors(Object.keys(fields).length ? fields : { form: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return { values, set: (patch: Partial<typeof values>) => setValues((f) => ({ ...f, ...patch })), errors, busy, submit };
}

/** The customer's name and email (order updates go on WhatsApp to their phone). */
export function useProfileForm(initial: { name: string; email: string }) {
  const queryClient = useQueryClient();
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<{ name?: string; email?: string; form?: string }>({});
  const [state, setState] = React.useState<"idle" | "busy" | "saved">("idle");

  const submit = async () => {
    setState("busy");
    setErrors({});
    try {
      queryClient.setQueryData(accountKeys.me, await updateProfile(values.name, values.email.trim() || null));
      setState("saved");
    } catch (err) {
      setState("idle");
      if (isApiError(err) && (err.errors.name || err.errors.email)) setErrors({ name: err.errors.name?.[0], email: err.errors.email?.[0] });
      else setErrors({ form: errorMessage(err) });
    }
  };

  return { values, set: (patch: Partial<typeof values>) => setValues((v) => ({ ...v, ...patch })), errors, state, submit };
}
