"use client";

import { useEffect } from "react";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const DURATION = 320;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * One small island per page that adds motion to server-rendered theme markup:
 * - scroll reveal: elements with `data-reveal` fade/slide in once; children of `data-reveal-stagger` follow one by one;
 * - FAQ: `details.t-acc` open and close with an animated height (native <details> keeps keyboard,
 *   screen reader and `name` one-at-a-time behaviour).
 * Without JavaScript, or with reduced motion, everything shows and toggles instantly.
 */
export function SiteEnhancer() {
  useEffect(() => {
    if (reducedMotion()) return;
    const root = document.documentElement;
    root.classList.add("lp-motion");

    // --- Scroll reveal --------------------------------------------------------------------------
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          reveal.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    const watch = (scope: ParentNode) => {
      scope.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-revealed)").forEach((el) => reveal.observe(el));
      scope.querySelectorAll<HTMLElement>("[data-reveal-stagger]").forEach((list) => {
        Array.from(list.children).forEach((child, i) => (child as HTMLElement).style.setProperty("--reveal-i", String(Math.min(i, 8))));
      });
    };
    watch(document);
    // Builder preview: sections are added / re-rendered while editing.
    const mutations = new MutationObserver(() => watch(document));
    mutations.observe(document.body, { childList: true, subtree: true });

    // --- FAQ height animation ------------------------------------------------------------------
    const running = new WeakMap<HTMLDetailsElement, { animation: Animation; opening: boolean }>();

    const animate = (details: HTMLDetailsElement, from: number, to: number, opening: boolean, done?: () => void) => {
      details.style.overflow = "hidden";
      const animation = details.animate({ height: [`${from}px`, `${to}px`] }, { duration: DURATION, easing: EASE });
      running.set(details, { animation, opening });
      animation.onfinish = () => {
        running.delete(details);
        details.style.overflow = "";
        done?.();
      };
    };

    const closedHeight = (details: HTMLDetailsElement) => {
      const summary = details.querySelector(":scope > summary") as HTMLElement | null;
      const style = getComputedStyle(details);
      const box = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      return (summary?.offsetHeight ?? 0) + box;
    };

    const collapse = (details: HTMLDetailsElement) => {
      const from = details.offsetHeight; // current height, even mid-animation
      running.get(details)?.animation.cancel();
      // Lets icons and styles react now, not when the animation ends (`group-data-[closing]:`).
      details.dataset.closing = "";
      animate(details, from, closedHeight(details), false, () => {
        details.open = false;
        delete details.dataset.closing;
      });
    };

    const expand = (details: HTMLDetailsElement) => {
      const from = details.open ? details.offsetHeight : closedHeight(details);
      running.get(details)?.animation.cancel();
      delete details.dataset.closing;
      // Opening a named <details> would close its siblings instantly; animate them instead.
      const name = details.getAttribute("name");
      if (name) {
        details.removeAttribute("name");
        document.querySelectorAll<HTMLDetailsElement>("details.t-acc[open]").forEach((other) => {
          if (other !== details && other.getAttribute("name") === name) collapse(other);
        });
      }
      details.open = true;
      animate(details, from, details.offsetHeight, true, () => {
        if (name) details.setAttribute("name", name);
      });
    };

    const onClick = (event: MouseEvent) => {
      const summary = (event.target as Element | null)?.closest("details.t-acc > summary");
      if (!summary) return;
      const details = summary.parentElement as HTMLDetailsElement;
      event.preventDefault();
      const state = running.get(details);
      const isOpen = state ? state.opening : details.open;
      if (isOpen) collapse(details);
      else expand(details);
    };
    document.addEventListener("click", onClick);

    return () => {
      reveal.disconnect();
      mutations.disconnect();
      document.removeEventListener("click", onClick);
      root.classList.remove("lp-motion");
    };
  }, []);

  return null;
}
