import { SearchX } from "lucide-react";
import { ar } from "@/messages/ar";

/** Any address nothing answers (unknown host or path): Arabic, instead of Next's default page. */
export default function NotFound() {
  const t = ar.common.notFound;
  return (
    <main dir="rtl" lang="ar" className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-white p-6 text-center text-neutral-800">
      <SearchX className="size-12 text-neutral-400" aria-hidden />
      <h1 className="text-2xl font-extrabold">{t.title}</h1>
      <p className="max-w-md text-sm text-neutral-500">{t.text}</p>
    </main>
  );
}
