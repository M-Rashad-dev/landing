import type { ReactNode } from "react";

/** Bold, square wireframes for the Builder library (Celia). currentColor = primary. */
function Frame({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <svg viewBox="0 0 120 72" className="h-full w-full" aria-hidden>
      <rect x="1" y="1" width="118" height="70" fill={dark ? "#111" : "#fff"} stroke="#111" strokeWidth="2" />
      {children}
    </svg>
  );
}
const block = (x: number, y: number, w: number, h: number, fill = "#111", o = 1) => <rect x={x} y={y} width={w} height={h} fill={fill} fillOpacity={o} />;

export const CeliaThumbs = {
  header: () => (
    <Frame>
      {block(1, 22, 118, 3)}
      {block(8, 9, 22, 7)}
      {block(46, 11, 10, 3, "#111", 0.5)}
      {block(60, 11, 10, 3, "#111", 0.5)}
      {block(90, 7, 22, 10, "currentColor")}
    </Frame>
  ),
  hero: () => (
    <Frame>
      {block(8, 8, 80, 10)}
      {block(8, 21, 60, 10)}
      {block(8, 40, 34, 8, "currentColor")}
      <rect x="60" y="36" width="52" height="28" fill="#ddd" stroke="#111" strokeWidth="2" />
    </Frame>
  ),
  gallery: () => (
    <Frame>
      <rect x="30" y="8" width="80" height="56" fill="#ddd" stroke="#111" strokeWidth="2" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x="8" y={8 + i * 19} width="16" height="16" fill="#eee" stroke="#111" strokeWidth="1.5" />
      ))}
    </Frame>
  ),
  product_showcase: () => (
    <Frame>
      <rect x="8" y="8" width="48" height="56" fill="#ddd" stroke="#111" strokeWidth="2" />
      {block(64, 10, 46, 8)}
      {block(64, 24, 30, 10, "currentColor")}
      {[0, 1, 2].map((i) => block(64, 40 + i * 8, 46, 2))}
    </Frame>
  ),
  features: () => (
    <Frame>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={8 + i * 36} y="12" width="32" height="48" fill="#fff" stroke="#111" strokeWidth="2" />
          <text x={12 + i * 36} y="30" fontSize="14" fontWeight="900" fill="currentColor">
            0{i + 1}
          </text>
          {block(12 + i * 36, 40, 22, 3, "#111", 0.6)}
        </g>
      ))}
    </Frame>
  ),
  offers: () => (
    <Frame>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={8 + i * 36} y="10" width="32" height="52" fill={i === 1 ? "currentColor" : "#fff"} stroke="#111" strokeWidth="2" />
          {block(12 + i * 36, 24, 20, 8, i === 1 ? "#fff" : "#111")}
        </g>
      ))}
    </Frame>
  ),
  testimonials: () => (
    <Frame>
      <rect x="8" y="8" width="50" height="34" fill="#111" />
      <rect x="62" y="8" width="50" height="22" fill="#fff" stroke="#111" strokeWidth="2" />
      <rect x="8" y="46" width="50" height="18" fill="#fff" stroke="#111" strokeWidth="2" />
      <rect x="62" y="34" width="50" height="30" fill="#fff" stroke="#111" strokeWidth="2" />
      <text x="48" y="24" fontSize="16" fill="#fff" fontWeight="900">”</text>
    </Frame>
  ),
  faq: () => (
    <Frame>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          {block(8, 18 + i * 13, 104, 2)}
          {block(12, 10 + i * 13, 50, 4, "#111", 0.6)}
          <text x="104" y={16 + i * 13} fontSize="9" fontWeight="900" fill="currentColor">
            +
          </text>
        </g>
      ))}
    </Frame>
  ),
  order_form: () => (
    <Frame>
      <rect x="20" y="6" width="80" height="60" fill="#fff" stroke="#111" strokeWidth="2" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x="28" y={14 + i * 11} width="64" height="7" fill="#fff" stroke="#111" strokeWidth="1.5" />
      ))}
      {block(28, 50, 64, 10)}
    </Frame>
  ),
  footer: () => (
    <Frame dark>
      <text x="10" y="28" fontSize="16" fontWeight="900" fill="#fff">
        BRAND
      </text>
      {[0, 1, 2].map((i) => block(10 + i * 36, 40, 26, 3, "#fff", 0.5))}
      {block(10, 56, 100, 1.5, "#fff", 0.4)}
    </Frame>
  ),
  video: () => (
    <Frame dark>
      {block(14, 10, 92, 46, "#fff", 0.15)}
      <path d="M54 25v16l14-8z" fill="currentColor" />
      {block(14, 60, 40, 4, "#fff", 0.6)}
    </Frame>
  ),
  before_after: () => (
    <Frame>
      {block(12, 10, 48, 52, "#111", 0.15)}
      {block(60, 10, 48, 52, "currentColor", 0.6)}
      {block(58, 10, 4, 52)}
      {block(12, 10, 14, 6)}
    </Frame>
  ),
  size_chart: () => (
    <Frame>
      {block(12, 10, 96, 10)}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          {block(12, 22 + i * 11, 96, 1.5, "#111", 0.6)}
          {block(18, 26 + i * 11, 10, 4, "currentColor")}
          {block(48, 26 + i * 11, 18, 3, "#111", 0.4)}
          {block(80, 26 + i * 11, 18, 3, "#111", 0.4)}
        </g>
      ))}
    </Frame>
  ),
  comparison: () => (
    <Frame>
      {block(70, 6, 20, 60, "currentColor", 0.25)}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          {block(10, 13 + i * 14, 48, 4, "#111", 0.6)}
          {block(76, 11 + i * 14, 8, 8, "currentColor")}
          {block(98, 14 + i * 14, 10, 2.5, "#111", 0.5)}
        </g>
      ))}
    </Frame>
  ),
  countdown: () => (
    <Frame>
      {block(1, 1, 118, 70, "currentColor")}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>{block(14 + i * 24, 20, 18, 22, "#fff")}</g>
      ))}
      {block(14, 50, 60, 5, "#fff", 0.7)}
    </Frame>
  ),
  sticky_cta: () => (
    <Frame>
      {block(12, 12, 70, 6, "#111", 0.25)}
      {block(12, 24, 50, 6, "#111", 0.25)}
      {block(1, 48, 118, 3)}
      {block(8, 56, 24, 8)}
      {block(40, 54, 72, 12, "currentColor")}
    </Frame>
  ),
};
