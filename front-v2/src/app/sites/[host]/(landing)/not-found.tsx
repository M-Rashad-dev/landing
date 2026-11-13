import Link from "next/link";
import { ar } from "@/messages/ar";

/** A landing page that does not exist (or is not published) on this store. */
export default function LandingNotFound() {
  return (
    <div dir="rtl" lang="ar" className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-white p-6 text-center text-neutral-800">
      <p className="text-5xl font-extrabold text-neutral-300">404</p>
      <h1 className="text-xl font-extrabold">{ar.storefront.notFound.title}</h1>
      <Link href="/" className="text-sm font-semibold underline">
        {ar.storefront.notFound.home}
      </Link>
    </div>
  );
}
