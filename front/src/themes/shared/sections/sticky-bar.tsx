"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Shows its children fixed at the bottom once the visitor scrolled past the first screen,
 * and hides them while the order form (#order) is on screen. Always shown in the Builder preview.
 */
export function StickyBar({ alwaysVisible, desktop, className, children }: { alwaysVisible: boolean; desktop: boolean; className?: string; children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [formInView, setFormInView] = useState(false);

  useEffect(() => {
    if (alwaysVisible) return;
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6);
    const frame = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });

    const form = document.getElementById("order");
    const observer = form ? new IntersectionObserver(([entry]) => setFormInView(entry.isIntersecting), { threshold: 0.15 }) : null;
    if (form) observer?.observe(form);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, [alwaysVisible]);

  const shown = alwaysVisible || (scrolled && !formInView);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[transform,opacity] duration-300 ease-out",
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
        !desktop && "md:hidden",
        className,
      )}
      aria-hidden={!shown}
    >
      {children}
    </div>
  );
}
