"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/**
 * Live countdown to `endsAt` (latin digits). Calls onExpire once at zero.
 * Renders nothing on the server pass to avoid hydration mismatches.
 */
export function Countdown({
  endsAt,
  onExpire,
  className,
  boxClassName,
  numberClassName,
  labelClassName,
}: {
  endsAt: string;
  onExpire?: () => void;
  className?: string;
  boxClassName?: string;
  numberClassName?: string;
  labelClassName?: string;
}) {
  const target = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const remaining = now === null ? null : target - now;

  useEffect(() => {
    if (remaining !== null && remaining <= 0) onExpire?.();
  }, [remaining, onExpire]);

  if (remaining === null || Number.isNaN(target)) return <div className={cn("h-14", className)} aria-hidden />;

  const p = parts(remaining);
  const units: Array<[number, string]> = [
    [p.days, ar.site.countdown.days],
    [p.hours, ar.site.countdown.hours],
    [p.minutes, ar.site.countdown.minutes],
    [p.seconds, ar.site.countdown.seconds],
  ];

  return (
    <div className={cn("flex items-center gap-2", className)} role="timer" aria-live="off" dir="rtl">
      {units.map(([value, label]) => (
        <div key={label} className={cn("flex min-w-14 flex-col items-center px-2 py-1.5", boxClassName)}>
          <span className={cn("text-xl font-extrabold tabular-nums", numberClassName)} dir="ltr">
            {String(value).padStart(2, "0")}
          </span>
          <span className={cn("text-[11px]", labelClassName)}>{label}</span>
        </div>
      ))}
    </div>
  );
}
