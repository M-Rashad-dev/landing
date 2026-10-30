"use client";

import { useEffect, useState } from "react";
import { fromCairoInputValue } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Countdown } from "@/themes/shared/components/countdown";

const STORAGE_PREFIX = "lp_cd_";

/** End time of an evergreen countdown: started on this visitor's first view, kept per section. */
function evergreenEnd(sectionId: string, minutes: number): string {
  const key = STORAGE_PREFIX + sectionId;
  try {
    const saved = window.localStorage.getItem(key);
    if (saved && !Number.isNaN(Date.parse(saved))) return saved;
    const end = new Date(Date.now() + minutes * 60_000).toISOString();
    window.localStorage.setItem(key, end);
    return end;
  } catch {
    return new Date(Date.now() + minutes * 60_000).toISOString();
  }
}

/** Fixed (Cairo time) or per-visitor countdown; shows `expired` once it reaches zero. */
export function CountdownTimer({
  sectionId,
  mode,
  endsAt,
  minutes,
  expired,
  boxClassName,
  labelClassName,
  className,
}: {
  sectionId: string;
  mode: "fixed" | "evergreen";
  endsAt: string;
  minutes: number;
  expired: React.ReactNode;
  boxClassName: string;
  labelClassName?: string;
  className?: string;
}) {
  const [visitorEnd, setVisitorEnd] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // The per-visitor end lives in the browser, so it is read after hydration (same HTML on server and client).
  useEffect(() => {
    if (mode !== "evergreen") return;
    const frame = requestAnimationFrame(() => setVisitorEnd(evergreenEnd(sectionId, Math.max(5, minutes || 120))));
    return () => cancelAnimationFrame(frame);
  }, [mode, sectionId, minutes]);

  const end = mode === "fixed" ? fromCairoInputValue(endsAt) : visitorEnd;
  if (done) return <>{expired}</>;
  if (!end) return <div className={cn("h-14", className)} aria-hidden />;
  // Countdown itself waits for the client clock and reports zero through onExpire.
  return <Countdown endsAt={end} onExpire={() => setDone(true)} className={className} boxClassName={boxClassName} numberClassName="text-2xl md:text-4xl" labelClassName={labelClassName} />;
}
