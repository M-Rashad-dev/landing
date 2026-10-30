import type { ReactNode } from "react";

/** Night wireframes for the Builder library («ليالي»). currentColor = primary. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 120 72" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="layali-glow" cx="30%" cy="20%" r="80%">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.45" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="1" y="1" width="118" height="70" rx="10" fill="#0d0f1a" />
      <rect x="1" y="1" width="118" height="70" rx="10" fill="url(#layali-glow)" />
      {children}
    </svg>
  );
}
const bar = (x: number, y: number, w: number, h = 4, o = 0.45) => <rect x={x} y={y} width={w} height={h} rx={h / 2} fill="#fff" fillOpacity={o} />;
const glass = (x: number, y: number, w: number, h: number, r = 6) => <rect x={x} y={y} width={w} height={h} rx={r} fill="#fff" fillOpacity="0.07" stroke="#fff" strokeOpacity="0.15" />;
const glow = (x: number, y: number, w: number, h: number, r = 5) => <rect x={x} y={y} width={w} height={h} rx={r} fill="currentColor" />;

export const LayaliThumbs = {
  header: () => (
    <Frame>
      {glass(8, 8, 104, 14, 7)}
      {bar(14, 13, 18, 4, 0.8)}
      {bar(50, 14, 22, 2.5)}
      {glow(88, 11, 20, 8, 4)}
    </Frame>
  ),
  hero: () => (
    <Frame>
      {bar(30, 12, 60, 7, 0.85)}
      {bar(38, 23, 44, 3)}
      <circle cx="60" cy="47" r="15" fill="currentColor" fillOpacity="0.35" />
      <circle cx="60" cy="47" r="10" fill="#fff" fillOpacity="0.2" />
      {glow(46, 64, 28, 5, 2.5)}
    </Frame>
  ),
  gallery: () => (
    <Frame>
      <rect x="22" y="8" width="76" height="42" rx="8" fill="currentColor" fillOpacity="0.3" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>{glass(30 + i * 16, 55, 12, 10, 3)}</g>
      ))}
    </Frame>
  ),
  product_showcase: () => (
    <Frame>
      <circle cx="32" cy="36" r="18" fill="currentColor" fillOpacity="0.35" />
      {bar(60, 18, 44, 6, 0.8)}
      {bar(60, 30, 30, 4, 0.5)}
      {glass(60, 40, 22, 9, 3)}
      {glass(84, 40, 22, 9, 3)}
      {glow(60, 54, 34, 8, 4)}
    </Frame>
  ),
  features: () => (
    <Frame>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          {glass(10 + i * 35, 14, 30, 44, 6)}
          {glow(16 + i * 35, 20, 9, 9, 3)}
          {bar(16 + i * 35, 36, 18, 3, 0.6)}
          {bar(16 + i * 35, 43, 14, 2.5, 0.3)}
        </g>
      ))}
    </Frame>
  ),
  offers: () => (
    <Frame>
      {glass(8, 14, 32, 46, 6)}
      <rect x="44" y="9" width="32" height="54" rx="6" fill="currentColor" fillOpacity="0.25" stroke="currentColor" />
      {glass(80, 14, 32, 46, 6)}
      {bar(50, 22, 20, 5, 0.85)}
      {glow(50, 50, 20, 6, 3)}
    </Frame>
  ),
  testimonials: () => (
    <Frame>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          {glass(8 + i * 36, 12, 32, 48, 6)}
          {bar(13 + i * 36, 20, 20, 2.5, 0.5)}
          {bar(13 + i * 36, 26, 22, 2.5, 0.35)}
          <circle cx={18 + i * 36} cy="50" r="4" fill="currentColor" />
        </g>
      ))}
    </Frame>
  ),
  faq: () => (
    <Frame>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          {glass(16, 10 + i * 14, 88, 11, 4)}
          {bar(22, 14 + i * 14, 40, 3, 0.55)}
          <circle cx="96" cy={15.5 + i * 14} r="2" fill="currentColor" />
        </g>
      ))}
    </Frame>
  ),
  order_form: () => (
    <Frame>
      <rect x="24" y="6" width="72" height="60" rx="8" fill="#fff" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.7" />
      {[0, 1, 2].map((i) => (
        <g key={i}>{glass(32, 14 + i * 12, 56, 8, 3)}</g>
      ))}
      {glow(32, 52, 56, 9, 4)}
    </Frame>
  ),
  footer: () => (
    <Frame>
      <rect x="8" y="22" width="104" height="1" fill="currentColor" />
      {bar(12, 32, 26, 5, 0.85)}
      {[0, 1].map((i) => (
        <g key={i}>
          {bar(56 + i * 28, 33, 20, 3, 0.5)}
          {bar(56 + i * 28, 40, 16, 3, 0.3)}
        </g>
      ))}
      {bar(12, 58, 96, 1.5, 0.2)}
    </Frame>
  ),
  video: () => (
    <Frame>
      <rect x="22" y="10" width="76" height="44" rx="8" fill="currentColor" fillOpacity="0.25" stroke="#fff" strokeOpacity="0.15" />
      <circle cx="60" cy="32" r="9" fill="currentColor" />
      <path d="M57 27.5v9l8-4.5z" fill="#fff" />
    </Frame>
  ),
  before_after: () => (
    <Frame>
      {glass(16, 10, 44, 52, 6)}
      <rect x="60" y="10" width="44" height="52" rx="6" fill="currentColor" fillOpacity="0.4" />
      <rect x="59" y="10" width="2" height="52" fill="#fff" />
      <circle cx="60" cy="36" r="5" fill="#fff" />
    </Frame>
  ),
  size_chart: () => (
    <Frame>
      {glass(14, 10, 92, 52, 6)}
      {bar(20, 16, 80, 3, 0.4)}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          {glow(20, 25 + i * 9, 8, 4, 2)}
          {bar(44, 26 + i * 9, 16, 2.5, 0.35)}
          {bar(74, 26 + i * 9, 16, 2.5, 0.35)}
        </g>
      ))}
    </Frame>
  ),
  comparison: () => (
    <Frame>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          {bar(14, 14 + i * 13, 44, 3, 0.45)}
          <circle cx="80" cy={15.5 + i * 13} r="4" fill="currentColor" />
          <circle cx="100" cy={15.5 + i * 13} r="4" fill="#fff" fillOpacity="0.15" />
        </g>
      ))}
    </Frame>
  ),
  countdown: () => (
    <Frame>
      {bar(36, 12, 48, 5, 0.8)}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>{glass(20 + i * 21, 24, 17, 20, 5)}</g>
      ))}
      {glow(42, 52, 36, 9, 4.5)}
    </Frame>
  ),
  sticky_cta: () => (
    <Frame>
      {bar(14, 14, 60, 4, 0.25)}
      {bar(14, 24, 44, 4, 0.25)}
      {glass(6, 48, 108, 18, 8)}
      {bar(12, 55, 20, 5, 0.8)}
      {glow(40, 52, 68, 10, 5)}
    </Frame>
  ),
};
