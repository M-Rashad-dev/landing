/**
 * Visual language of the shared conversion sections (video, before/after, size chart, comparison,
 * countdown, sticky button) per theme. The markup is shared; each theme only picks its classes,
 * so a new theme adds one entry here.
 */
export type BlockLook = {
  section: string;
  container: string;
  heading: string;
  headingAlign: string;
  subtitle: string;
  /** Raised surface (cards, tables). */
  card: string;
  /** Image / video frame. */
  frame: string;
  tint: string;
  button: string;
  /** Small rounded label on images. */
  chip: string;
  /** Header cells of tables. */
  tableHead: string;
  /** Lines between table rows. */
  rowLine: string;
  /** Countdown digit boxes. */
  digit: string;
  /** Fixed bar at the bottom of the screen. */
  bar: string;
};

export const LOOKS = {
  malak: {
    section: "px-4 py-16 md:py-24",
    container: "mx-auto max-w-5xl",
    heading: "t-heading text-2xl font-bold md:text-3xl",
    headingAlign: "mx-auto mb-10 max-w-2xl text-center",
    subtitle: "t-muted mt-3 leading-relaxed",
    card: "t-bg rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,.06)]",
    frame: "overflow-hidden rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,.10)]",
    tint: "t-tint rounded-3xl",
    button: "t-primary t-btn inline-flex min-h-12 items-center justify-center gap-2 px-8 text-base font-bold shadow-[0_8px_24px_rgba(0,0,0,.12)] transition-transform hover:-translate-y-0.5",
    chip: "rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur",
    tableHead: "t-tint-strong font-bold",
    rowLine: "border-b t-border last:border-b-0",
    digit: "t-bg rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,.06)]",
    bar: "t-bg border-t t-border shadow-[0_-8px_30px_rgba(0,0,0,.08)]",
  },
  celia: {
    section: "t-bg border-t-[3px] t-line px-4 py-12 md:py-16",
    container: "mx-auto max-w-5xl",
    heading: "t-heading text-3xl font-black uppercase tracking-tight md:text-5xl",
    headingAlign: "mb-8",
    subtitle: "t-muted mt-2",
    card: "t-bg t-hard",
    frame: "overflow-hidden t-hard",
    tint: "t-tint t-hard",
    button: "t-primary t-btn t-hard t-press inline-flex min-h-14 items-center justify-center gap-2 px-8 text-lg font-extrabold",
    chip: "t-inverse px-2.5 py-1 text-xs font-black uppercase",
    tableHead: "t-inverse font-black uppercase",
    rowLine: "border-b-2 t-line last:border-b-0",
    digit: "t-bg t-hard-sm",
    bar: "t-bg border-t-[3px] t-line",
  },
  layali: {
    section: "relative px-4 py-20 md:py-28",
    container: "mx-auto max-w-5xl",
    heading: "t-heading l-grad-text text-3xl font-bold leading-tight md:text-4xl",
    headingAlign: "mx-auto mb-12 max-w-2xl text-center",
    subtitle: "t-muted mt-4 leading-relaxed",
    card: "l-glass rounded-[1.75rem]",
    frame: "overflow-hidden rounded-[1.75rem] ring-1 ring-white/10 shadow-[0_30px_80px_-30px_var(--c-primary)]",
    tint: "l-glass rounded-[2rem]",
    button: "t-primary t-btn l-glow-btn inline-flex min-h-12 items-center justify-center gap-2 px-8 text-base font-bold",
    chip: "rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur",
    tableHead: "border-b l-line text-[var(--c-accent)] font-bold",
    rowLine: "border-b l-line last:border-b-0",
    digit: "l-glass rounded-2xl",
    bar: "l-glass rounded-t-3xl border-b-0",
  },
} satisfies Record<string, BlockLook>;

export type LookKey = keyof typeof LOOKS;
