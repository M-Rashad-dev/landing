import type { Metadata } from "next";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.errors.notFoundTitle, robots: { index: false } };

/** Generic Arabic 404 (served for unknown hosts/paths on every host). */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-white px-6 text-center text-slate-900" style={{ fontFamily: "system-ui, sans-serif" }}>
      <p className="text-7xl font-extrabold text-slate-300">404</p>
      <h1 className="text-2xl font-bold">{ar.errors.notFoundTitle}</h1>
      <p className="max-w-md text-slate-500">{ar.errors.notFoundText}</p>
    </main>
  );
}
