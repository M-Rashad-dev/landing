"use client";

import * as React from "react";

/**
 * Motion for the marketing page, all in-house:
 * - reveal: `[data-reveal]` elements fade / rise / un-blur as they enter (CSS does the drawing, this only adds `is-in`);
 * - smooth wheel scrolling on desktop mice (eased toward the target, like a native app), off for touch and reduced motion;
 * - `--mk-hero` (0 → 1 over the first screen) for the hero dashboard tilt.
 * Without JavaScript or with reduced motion everything is simply visible (see the inline script in the page).
 */
export function MotionRoot() {
  React.useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      root.classList.remove("mk-js");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    const watch = () => document.querySelectorAll("[data-reveal]:not(.is-in)").forEach((el) => observer.observe(el));
    watch();
    const mutations = new MutationObserver(watch);
    mutations.observe(document.body, { childList: true, subtree: true });

    const stopScroll = smoothScroll();
    const stopHero = heroProgress();
    return () => {
      observer.disconnect();
      mutations.disconnect();
      stopScroll();
      stopHero();
    };
  }, []);
  return null;
}

function heroProgress(): () => void {
  let frame = 0;
  const update = () => {
    frame = 0;
    const p = Math.min(1, window.scrollY / Math.max(320, window.innerHeight * 0.6));
    document.documentElement.style.setProperty("--mk-hero", p.toFixed(3));
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    window.removeEventListener("scroll", onScroll);
    cancelAnimationFrame(frame);
  };
}

/** Header offset for in-page links. */
const OFFSET = 84;

/**
 * Eased wheel scrolling for mice: the wheel moves a target and the page glides to it.
 * Keyboard, scrollbar, touch and find-in-page keep the browser's own scrolling (we just follow it).
 * Inner scroll areas keep their own wheel.
 */
function smoothScroll(): () => void {
  const fine = window.matchMedia("(pointer: fine)").matches;
  let target = window.scrollY;
  let current = window.scrollY;
  let frame = 0;
  let gliding = false;

  const max = () => document.documentElement.scrollHeight - window.innerHeight;
  const tick = () => {
    current += (target - current) * 0.11;
    if (Math.abs(target - current) < 0.4) {
      current = target;
      gliding = false;
    }
    window.scrollTo({ top: current, behavior: "instant" });
    frame = gliding ? requestAnimationFrame(tick) : 0;
  };
  const glideTo = (top: number) => {
    target = Math.max(0, Math.min(max(), top));
    if (!gliding) {
      gliding = true;
      current = window.scrollY;
      frame = requestAnimationFrame(tick);
    }
  };

  const scrollsItself = (node: EventTarget | null, dy: number): boolean => {
    let el = node instanceof Element ? node : null;
    while (el && el !== document.body) {
      const style = getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) {
        if ((dy < 0 && el.scrollTop > 0) || (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight)) return true;
      }
      el = el.parentElement;
    }
    return false;
  };

  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
    if (scrollsItself(e.target, dy)) return;
    e.preventDefault();
    glideTo((gliding ? target : window.scrollY) + dy);
  };
  const onScroll = () => {
    if (!gliding) target = current = window.scrollY;
  };
  // In-page links glide too (and land below the sticky header).
  const onClick = (e: MouseEvent) => {
    const link = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = decodeURIComponent(link.getAttribute("href")!.slice(1));
    const section = id ? document.getElementById(id) : null;
    if (!section && id) return;
    e.preventDefault();
    history.replaceState(null, "", id ? `#${id}` : window.location.pathname);
    const top = section ? section.getBoundingClientRect().top + window.scrollY - OFFSET : 0;
    if (fine) glideTo(top);
    else window.scrollTo({ top, behavior: "smooth" });
  };

  if (fine) window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("click", onClick);
  return () => {
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("click", onClick);
    cancelAnimationFrame(frame);
  };
}

/** A number that counts up the first time it is seen. The server renders the final value. */
export function CountUp({ value, decimals = 0, suffix = "", duration = 1400 }: { value: number; decimals?: number; suffix?: string; duration?: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const format = React.useCallback((n: number) => `${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`, [decimals, suffix]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.textContent = format(0);
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          el.textContent = format(value * (1 - Math.pow(1 - t, 4)));
          if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration, format]);

  return (
    <span ref={ref} className="tabular">
      {format(value)}
    </span>
  );
}
