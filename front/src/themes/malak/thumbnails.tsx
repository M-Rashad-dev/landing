import type { ReactNode } from "react";

/** Soft, rounded wireframes for the Builder library (Malak). currentColor = primary. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 120 72" className="h-full w-full" aria-hidden>
      <rect x="1" y="1" width="118" height="70" rx="10" fill="currentColor" fillOpacity="0.06" />
      {children}
    </svg>
  );
}
const bar = (x: number, y: number, w: number, h = 5, o = 0.35) => <rect x={x} y={y} width={w} height={h} rx={h / 2} fill="currentColor" fillOpacity={o} />;

export const MalakThumbs = {
  header: () => (
    <Frame>
      {bar(8, 10, 16, 6, 0.5)}
      {bar(48, 11, 24, 4)}
      <rect x="92" y="8" width="20" height="10" rx="5" fill="currentColor" fillOpacity="0.7" />
    </Frame>
  ),
  hero: () => (
    <Frame>
      {bar(10, 18, 44, 7, 0.6)}
      {bar(10, 30, 36)}
      {bar(10, 40, 30)}
      <rect x="10" y="50" width="26" height="10" rx="5" fill="currentColor" fillOpacity="0.7" />
      <rect x="66" y="12" width="44" height="48" rx="14" fill="currentColor" fillOpacity="0.25" />
    </Frame>
  ),
  gallery: () => (
    <Frame>
      <rect x="20" y="8" width="80" height="42" rx="10" fill="currentColor" fillOpacity="0.25" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={30 + i * 16} y="55" width="12" height="10" rx="3" fill="currentColor" fillOpacity="0.35" />
      ))}
    </Frame>
  ),
  product_showcase: () => (
    <Frame>
      <rect x="30" y="6" width="60" height="60" rx="12" fill="currentColor" fillOpacity="0.12" />
      <rect x="44" y="12" width="32" height="20" rx="6" fill="currentColor" fillOpacity="0.3" />
      {bar(42, 38, 36, 5, 0.55)}
      {bar(48, 47, 24, 4)}
      <rect x="46" y="54" width="28" height="8" rx="4" fill="currentColor" fillOpacity="0.7" />
    </Frame>
  ),
  features: () => (
    <Frame>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={8 + i * 36} y="14" width="32" height="44" rx="10" fill="currentColor" fillOpacity="0.12" />
          <circle cx={24 + i * 36} cy="28" r="6" fill="currentColor" fillOpacity="0.45" />
          {bar(14 + i * 36, 40, 20, 4)}
          {bar(16 + i * 36, 48, 16, 3, 0.25)}
        </g>
      ))}
    </Frame>
  ),
  offers: () => (
    <Frame>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={8 + i * 36} y="10" width="32" height="52" rx="10" fill="currentColor" fillOpacity={i === 1 ? 0.25 : 0.12} />
          {bar(16 + i * 36, 24, 16, 6, 0.6)}
          <rect x={12 + i * 36} y="48" width="24" height="8" rx="4" fill="currentColor" fillOpacity="0.6" />
        </g>
      ))}
    </Frame>
  ),
  testimonials: () => (
    <Frame>
      {[0, 1].map((i) => (
        <g key={i}>
          <rect x={10 + i * 52} y="12" width="48" height="48" rx="12" fill="currentColor" fillOpacity="0.12" />
          {bar(16 + i * 52, 20, 22, 3, 0.5)}
          {bar(16 + i * 52, 30, 36, 3)}
          {bar(16 + i * 52, 38, 30, 3)}
          <circle cx={22 + i * 52} cy="50" r="5" fill="currentColor" fillOpacity="0.4" />
        </g>
      ))}
    </Frame>
  ),
  faq: () => (
    <Frame>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="14" y={8 + i * 15} width="92" height="11" rx="5.5" fill="currentColor" fillOpacity="0.14" />
          {bar(20, 11 + i * 15, 44, 4, 0.4)}
          <circle cx="98" cy={13.5 + i * 15} r="3" fill="currentColor" fillOpacity="0.6" />
        </g>
      ))}
    </Frame>
  ),
  order_form: () => (
    <Frame>
      <rect x="24" y="6" width="72" height="60" rx="12" fill="currentColor" fillOpacity="0.1" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x="32" y={14 + i * 12} width="56" height="8" rx="4" fill="currentColor" fillOpacity="0.2" />
      ))}
      <rect x="32" y="52" width="56" height="9" rx="4.5" fill="currentColor" fillOpacity="0.7" />
    </Frame>
  ),
  footer: () => (
    <Frame>
      {bar(46, 22, 28, 6, 0.5)}
      {bar(36, 34, 48, 3)}
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={50 + i * 10} cy="46" r="3.5" fill="currentColor" fillOpacity="0.45" />
      ))}
      {bar(30, 58, 60, 2, 0.2)}
    </Frame>
  ),
};
