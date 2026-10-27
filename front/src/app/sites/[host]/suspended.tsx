import { ar } from "@/messages/ar";

/** Shown on every host of a suspended tenant. */
export function SuspendedStore() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-white px-6 text-center text-slate-900" style={{ fontFamily: "system-ui, sans-serif" }}>
      <p className="text-6xl" aria-hidden>
        ⏸
      </p>
      <h1 className="text-2xl font-bold">{ar.errors.suspendedTitle}</h1>
      <p className="max-w-md text-slate-500">{ar.errors.suspendedText}</p>
    </main>
  );
}
