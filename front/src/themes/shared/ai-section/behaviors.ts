/**
 * Interactive DOM behaviors for AI sections (docs/plans/ai-designer.md §3.6).
 * Attached in `live`, `preview`, and the main `builder` canvas so motion/timers match live;
 * quick-add cart actions are only bound in `live` mode.
 */
export function attachBehaviors(
  root: HTMLElement,
  opts: { onAdd?: (productId: number) => void } = {},
): () => void {
  const cleanups: Array<() => void> = [];
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const behaviorNodes = collectWithRoot(root, "[data-ai-behavior]");
  for (const node of behaviorNodes) {
    const kind = node.getAttribute("data-ai-behavior");
    if (kind === "slider") {
      cleanups.push(initSlider(node, reducedMotion));
    } else if (kind === "marquee") {
      cleanups.push(initMarquee(node, reducedMotion));
    } else if (kind === "tabs") {
      cleanups.push(initTabs(node));
    } else if (kind === "accordion") {
      cleanups.push(initAccordion(node));
    } else if (kind === "countdown") {
      cleanups.push(initCountdown(node));
    }
  }

  cleanups.push(initReveal(root, reducedMotion));
  cleanups.push(initQuickAdd(root, opts.onAdd));
  cleanups.push(initCopy(root));
  cleanups.push(initMediaEmbeds(root));

  return () => {
    for (const fn of cleanups) {
      fn();
    }
  };
}

function collectWithRoot(root: HTMLElement, selector: string): HTMLElement[] {
  const list: HTMLElement[] = [];
  if (root.matches(selector)) {
    list.push(root);
  }
  root.querySelectorAll<HTMLElement>(selector).forEach((el) => list.push(el));
  return list;
}

function initSlider(container: HTMLElement, reducedMotion: boolean): () => void {
  const track = container.querySelector<HTMLElement>("[data-ai-track]");
  if (!track) return () => {};

  const prevBtn = container.querySelector<HTMLElement>("[data-ai-prev]");
  const nextBtn = container.querySelector<HTMLElement>("[data-ai-next]");
  const dotsWrap = container.querySelector<HTMLElement>("[data-ai-dots]");
  const slides = Array.from(track.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
  const count = slides.length;
  if (count === 0) return () => {};

  let currentIndex = 0;
  const loop = container.hasAttribute("data-ai-loop");
  const autoplayAttr = Number(container.getAttribute("data-ai-autoplay") ?? "0");
  const autoplayMs = !reducedMotion && autoplayAttr >= 1500 && autoplayAttr <= 15000 ? autoplayAttr : 0;

  const getStepWidth = (): number => {
    const first = slides[0];
    return first && first.offsetWidth > 0 ? first.offsetWidth : track.clientWidth || 300;
  };

  const getDirectionSign = (): number => {
    const dir = typeof window !== "undefined" ? window.getComputedStyle(track).direction : "rtl";
    return dir === "rtl" ? -1 : 1;
  };

  const dotButtons: HTMLButtonElement[] = [];
  const updateDots = (activeIdx: number) => {
    dotButtons.forEach((btn, idx) => {
      const active = idx === activeIdx;
      btn.setAttribute("aria-current", active ? "true" : "false");
      btn.dataset.active = active ? "true" : "false";
    });
  };

  if (dotsWrap) {
    dotsWrap.innerHTML = "";
    slides.forEach((_, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", `${idx + 1}`);
      btn.addEventListener("click", () => {
        const diff = idx - currentIndex;
        currentIndex = idx;
        track.scrollBy({ left: diff * getStepWidth() * getDirectionSign(), behavior: "smooth" });
        updateDots(currentIndex);
      });
      dotsWrap.appendChild(btn);
      dotButtons.push(btn);
    });
    updateDots(0);
  }

  const step = (delta: number) => {
    let nextIdx = currentIndex + delta;
    if (nextIdx >= count) {
      nextIdx = loop ? 0 : count - 1;
    } else if (nextIdx < 0) {
      nextIdx = loop ? count - 1 : 0;
    }
    const actualDelta = nextIdx - currentIndex;
    currentIndex = nextIdx;
    track.scrollBy({
      left: (actualDelta !== 0 ? actualDelta : delta) * getStepWidth() * getDirectionSign(),
      behavior: "smooth",
    });
    updateDots(currentIndex);
  };

  const onPrev = () => step(-1);
  const onNext = () => step(1);

  prevBtn?.addEventListener("click", onPrev);
  nextBtn?.addEventListener("click", onNext);

  let paused = false;
  const pause = () => {
    paused = true;
  };
  const resume = () => {
    paused = false;
  };

  container.addEventListener("mouseenter", pause);
  container.addEventListener("mouseleave", resume);
  container.addEventListener("touchstart", pause, { passive: true });
  container.addEventListener("touchend", resume);
  container.addEventListener("focusin", pause);
  container.addEventListener("focusout", resume);

  let timer: ReturnType<typeof setInterval> | null = null;
  if (autoplayMs > 0) {
    timer = setInterval(() => {
      if (!paused) {
        step(1);
      }
    }, autoplayMs);
  }

  return () => {
    prevBtn?.removeEventListener("click", onPrev);
    nextBtn?.removeEventListener("click", onNext);
    container.removeEventListener("mouseenter", pause);
    container.removeEventListener("mouseleave", resume);
    container.removeEventListener("touchstart", pause);
    container.removeEventListener("touchend", resume);
    container.removeEventListener("focusin", pause);
    container.removeEventListener("focusout", resume);
    if (timer) clearInterval(timer);
  };
}

function initMarquee(container: HTMLElement, reducedMotion: boolean): () => void {
  if (reducedMotion) return () => {};
  const track = container.querySelector<HTMLElement>("[data-ai-track]");
  if (!track) return () => {};

  const originals = Array.from(track.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement,
  );
  if (originals.length === 0) return () => {};

  // Read direction BEFORE overriding inline animation properties
  const dirAttr = container.getAttribute("data-ai-direction");
  const isReverse =
    dirAttr === "reverse" || window.getComputedStyle(track).animationDirection === "reverse";
  const isRtl = window.getComputedStyle(track).direction === "rtl";

  const prevOverflowX = container.style.overflowX;
  const prevDisplay = track.style.display;
  const prevWidth = track.style.width;
  const prevAnimName = track.style.animationName;
  const prevAnimDur = track.style.animationDuration;
  const prevAnimTiming = track.style.animationTimingFunction;
  const prevAnimIter = track.style.animationIterationCount;
  const prevAnimDir = track.style.animationDirection;
  const prevPlayState = track.style.animationPlayState;
  const prevShift = track.style.getPropertyValue("--ai-marquee-shift");

  if (window.getComputedStyle(container).overflowX === "visible") {
    container.style.overflowX = "clip";
  }
  if (window.getComputedStyle(track).display === "block") {
    track.style.display = "flex";
  }
  track.style.width = "max-content";

  const clones: Node[] = [];
  const baseWidth = Math.max(1, track.scrollWidth);
  const viewWidth = Math.max(container.clientWidth || 0, 1280);
  const repeatsPerHalf = Math.min(8, Math.max(1, Math.ceil((viewWidth + 64) / baseWidth)));

  // Repeat items so a single half always fills the widest desktop viewport without blank gaps
  for (let r = 1; r < repeatsPerHalf; r++) {
    for (const child of originals) {
      const clone = child.cloneNode(true);
      if (clone instanceof HTMLElement) {
        clone.setAttribute("aria-hidden", "true");
      }
      track.appendChild(clone);
      clones.push(clone);
    }
  }

  // Clone the full first half once to guarantee a seamless continuous loop
  const halfANodes = Array.from(track.children);
  let halfBFirst: HTMLElement | null = null;
  for (const node of halfANodes) {
    const clone = node.cloneNode(true);
    if (clone instanceof HTMLElement) {
      clone.setAttribute("aria-hidden", "true");
      if (!halfBFirst) halfBFirst = clone;
    }
    track.appendChild(clone);
    clones.push(clone);
  }

  const updateShift = () => {
    const firstEl = originals[0];
    if (!firstEl || !halfBFirst) {
      track.style.setProperty("--ai-marquee-shift", isRtl ? "50%" : "-50%");
      return;
    }
    const r1 = firstEl.getBoundingClientRect();
    const r2 = halfBFirst.getBoundingClientRect();
    const cyclePx = isRtl ? r1.right - r2.right : r2.left - r1.left;
    if (cyclePx > 10) {
      track.style.setProperty("--ai-marquee-shift", isRtl ? `${cyclePx}px` : `-${cyclePx}px`);
    } else {
      track.style.setProperty("--ai-marquee-shift", isRtl ? "50%" : "-50%");
    }
  };

  updateShift();

  const speed = container.getAttribute("data-ai-speed") ?? "normal";
  const duration = speed === "slow" ? "36s" : speed === "fast" ? "14s" : "24s";

  track.style.animationName = "ai-marquee-scroll";
  track.style.animationDuration = duration;
  track.style.animationTimingFunction = "linear";
  track.style.animationIterationCount = "infinite";
  track.style.animationDirection = isReverse ? "reverse" : "normal";

  const pause = () => {
    track.style.animationPlayState = "paused";
  };
  const resume = () => {
    track.style.animationPlayState = "running";
  };

  container.addEventListener("mouseenter", pause);
  container.addEventListener("mouseleave", resume);
  container.addEventListener("focusin", pause);
  container.addEventListener("focusout", resume);

  const ro =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateShift()) : null;
  ro?.observe(track);
  ro?.observe(container);

  return () => {
    ro?.disconnect();
    container.removeEventListener("mouseenter", pause);
    container.removeEventListener("mouseleave", resume);
    container.removeEventListener("focusin", pause);
    container.removeEventListener("focusout", resume);
    track.style.animationName = prevAnimName;
    track.style.animationDuration = prevAnimDur;
    track.style.animationTimingFunction = prevAnimTiming;
    track.style.animationIterationCount = prevAnimIter;
    track.style.animationDirection = prevAnimDir;
    track.style.animationPlayState = prevPlayState;
    if (prevShift) track.style.setProperty("--ai-marquee-shift", prevShift);
    else track.style.removeProperty("--ai-marquee-shift");
    track.style.display = prevDisplay;
    track.style.width = prevWidth;
    container.style.overflowX = prevOverflowX;
    for (const c of clones) {
      if (c.parentNode === track) {
        track.removeChild(c);
      }
    }
  };
}

function initTabs(container: HTMLElement): () => void {
  const tabs = Array.from(container.querySelectorAll<HTMLElement>("[data-ai-tab]"));
  const panels = Array.from(container.querySelectorAll<HTMLElement>("[data-ai-panel]"));
  if (tabs.length === 0 || panels.length === 0) return () => {};

  const activate = (activeIndex: number) => {
    tabs.forEach((tab, idx) => {
      const isSelected = idx === activeIndex;
      tab.setAttribute("aria-selected", isSelected ? "true" : "false");
      tab.dataset.active = isSelected ? "true" : "false";
    });
    panels.forEach((panel, idx) => {
      panel.hidden = idx !== activeIndex;
    });
  };

  activate(0);

  const handlers = tabs.map((tab, idx) => {
    const fn = () => activate(idx);
    tab.addEventListener("click", fn);
    return () => tab.removeEventListener("click", fn);
  });

  return () => {
    for (const off of handlers) off();
  };
}

function initAccordion(container: HTMLElement): () => void {
  const items = Array.from(container.querySelectorAll<HTMLElement>("[data-ai-item]"));
  if (items.length === 0) return () => {};

  const single = container.hasAttribute("data-ai-single");
  const handlers: Array<() => void> = [];

  const entries = items
    .map((item) => {
      const toggle = item.querySelector<HTMLElement>("[data-ai-toggle]");
      const content = item.querySelector<HTMLElement>("[data-ai-content]");
      return toggle && content ? { item, toggle, content } : null;
    })
    .filter((x): x is { item: HTMLElement; toggle: HTMLElement; content: HTMLElement } => x !== null);

  entries.forEach((entry, idx) => {
    const initialOpen = idx === 0 && !entry.content.hasAttribute("hidden");
    entry.content.hidden = !initialOpen;
    entry.toggle.setAttribute("aria-expanded", initialOpen ? "true" : "false");

    const onClick = () => {
      const willOpen = entry.content.hidden;
      if (single && willOpen) {
        entries.forEach((other) => {
          other.content.hidden = true;
          other.toggle.setAttribute("aria-expanded", "false");
          other.item.dataset.open = "false";
        });
      }
      entry.content.hidden = !willOpen;
      entry.toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
      entry.item.dataset.open = willOpen ? "true" : "false";
    };

    entry.toggle.addEventListener("click", onClick);
    handlers.push(() => entry.toggle.removeEventListener("click", onClick));
  });

  return () => {
    for (const off of handlers) off();
  };
}

function initCountdown(container: HTMLElement): () => void {
  const endsStr = container.getAttribute("data-ai-ends") ?? "";
  const endsMs = Date.parse(endsStr);
  const daysEl = container.querySelector<HTMLElement>("[data-ai-days]");
  const hoursEl = container.querySelector<HTMLElement>("[data-ai-hours]");
  const minutesEl = container.querySelector<HTMLElement>("[data-ai-minutes]");
  const secondsEl = container.querySelector<HTMLElement>("[data-ai-seconds]");

  const pad = (n: number): string => String(Math.max(0, n)).padStart(2, "0");

  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    if (Number.isNaN(endsMs)) {
      container.setAttribute("data-ai-ended", "true");
      return;
    }
    const diffSec = Math.max(0, Math.floor((endsMs - Date.now()) / 1000));
    const d = Math.floor(diffSec / 86400);
    const h = Math.floor((diffSec % 86400) / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;

    if (daysEl) daysEl.textContent = pad(d);
    if (hoursEl) hoursEl.textContent = pad(h);
    if (minutesEl) minutesEl.textContent = pad(m);
    if (secondsEl) secondsEl.textContent = pad(s);

    if (diffSec <= 0) {
      container.setAttribute("data-ai-ended", "true");
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
  };

  tick();
  if (!container.hasAttribute("data-ai-ended")) {
    timer = setInterval(tick, 1000);
  }

  return () => {
    if (timer) clearInterval(timer);
  };
}

function initReveal(root: HTMLElement, reducedMotion: boolean): () => void {
  const targets = collectWithRoot(root, "[data-ai-reveal]");
  if (targets.length === 0) return () => {};

  if (reducedMotion || typeof IntersectionObserver === "undefined") {
    targets.forEach((el) => el.setAttribute("data-ai-shown", "true"));
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.target instanceof HTMLElement) {
          entry.target.setAttribute("data-ai-shown", "true");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0, rootMargin: "0px 0px -8% 0px" },
  );

  targets.forEach((el) => observer.observe(el));

  return () => {
    observer.disconnect();
  };
}

function initQuickAdd(root: HTMLElement, onAdd?: (productId: number) => void): () => void {
  if (!onAdd) return () => {};

  const onClick = (e: MouseEvent) => {
    const target = e.target instanceof Element ? e.target.closest<HTMLButtonElement>("button[data-ai-add]") : null;
    if (!target || !root.contains(target)) return;
    const id = Number(target.getAttribute("data-ai-add"));
    if (Number.isInteger(id) && id > 0) {
      onAdd(id);
    }
  };

  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback on HTTP / restricted origins
    }
  }

  if (typeof document === "undefined" || !document.body) {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  document.body.removeChild(textarea);
  if (savedRange && selection) {
    selection.removeAllRanges();
    selection.addRange(savedRange);
  }

  return copied;
}

function initCopy(root: HTMLElement): () => void {
  const active = new Map<HTMLButtonElement, { nodes: ChildNode[]; timer: number }>();

  const restore = (btn: HTMLButtonElement, nodes: ChildNode[]) => {
    active.delete(btn);
    if (!root.contains(btn)) return;
    btn.removeAttribute("data-ai-copied-active");
    btn.replaceChildren(...nodes);
  };

  const onClick = (e: MouseEvent) => {
    const target = e.target instanceof Element ? e.target.closest<HTMLButtonElement>("button[data-ai-copy]") : null;
    if (!target || !root.contains(target)) return;

    const text = target.getAttribute("data-ai-copy") ?? "";
    if (!text) return;

    const copiedLabel = target.getAttribute("data-ai-copied")?.trim() || "تم النسخ ✓";

    void copyTextToClipboard(text).then((ok) => {
      if (!ok || !root.contains(target)) return;

      const existing = active.get(target);
      const nodes = existing ? existing.nodes : Array.from(target.childNodes);
      if (existing) {
        window.clearTimeout(existing.timer);
      }

      target.setAttribute("data-ai-copied-active", "true");
      target.textContent = copiedLabel;

      const timer = window.setTimeout(() => restore(target, nodes), 2000);
      active.set(target, { nodes, timer });
    });
  };

  root.addEventListener("click", onClick);

  return () => {
    root.removeEventListener("click", onClick);
    active.forEach(({ nodes, timer }, btn) => {
      window.clearTimeout(timer);
      if (root.contains(btn)) {
        btn.removeAttribute("data-ai-copied-active");
        btn.replaceChildren(...nodes);
      }
    });
    active.clear();
  };
}

function parseVideoEmbedUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.replace(/^(www|m)\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).match(/^[\w-]+/)?.[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
    }
    if (host === "youtube.com") {
      const id = u.searchParams.get("v")?.match(/^[\w-]+$/)?.[0] ??
        u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = u.pathname.match(/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function isSafeHttpsUrl(raw: string): boolean {
  if (!raw || raw.length > 500 || /[\u0000-\u0020"'<>]/.test(raw)) return false;
  return /^https:\/\/[^\s"'<>]+$/i.test(raw);
}

function isSafeAudioSrc(raw: string): boolean {
  if (isSafeHttpsUrl(raw)) return true;
  return /^\/media\/tenants\/\d+\/\d{4}\/\d{2}\/[a-z0-9]+-audio\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(raw);
}

function makeMediaPlaceholder(text: string, kind: "video" | "audio"): HTMLDivElement {
  const box = document.createElement("div");
  box.className = `ai-media-placeholder ai-media-placeholder--${kind}`;
  box.textContent = text;
  return box;
}

function initMediaEmbeds(root: HTMLElement): () => void {
  const isLive = root.getAttribute("data-ai-mode") === "live";

  for (const el of collectWithRoot(root, "[data-ai-video]")) {
    const url = (el.getAttribute("data-ai-video") ?? "").trim();
    el.hidden = false;
    const embed = url ? parseVideoEmbedUrl(url) : null;

    if (embed) {
      const iframe = document.createElement("iframe");
      iframe.src = embed;
      iframe.title = "فيديو";
      iframe.loading = "lazy";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.className = "ai-video-frame";
      el.replaceChildren(iframe);
    } else if (isSafeHttpsUrl(url)) {
      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.src = url;
      video.className = "ai-video-native";
      el.replaceChildren(video);
    } else if (!isLive) {
      el.replaceChildren(makeMediaPlaceholder("فيديو — أضف رابط الفيديو من إعدادات القسم", "video"));
    } else {
      el.replaceChildren();
      el.hidden = true;
    }
  }

  for (const el of collectWithRoot(root, "[data-ai-audio]")) {
    const url = (el.getAttribute("data-ai-audio") ?? "").trim();
    el.hidden = false;

    if (isSafeAudioSrc(url)) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "metadata";
      audio.src = url;
      audio.className = "ai-audio-native";
      el.replaceChildren(audio);
    } else if (!isLive) {
      el.replaceChildren(makeMediaPlaceholder("صوت — أضف رابط صوت أو ارفع ملف من إعدادات القسم", "audio"));
    } else {
      el.replaceChildren();
      el.hidden = true;
    }
  }

  return () => {
    for (const media of root.querySelectorAll<HTMLMediaElement>("video, audio")) {
      media.pause();
    }
  };
}

