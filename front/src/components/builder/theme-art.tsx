/** Illustrated thumbnails for the theme picker (pure SVG, no external images). */
export function ThemeArt({ themeKey }: { themeKey: string }) {
  if (themeKey === "celia") {
    return (
      <svg viewBox="0 0 240 150" className="h-full w-full" aria-hidden>
        <rect width="240" height="150" fill="#fafafa" />
        <rect x="0" y="0" width="240" height="18" fill="#111" />
        <rect x="12" y="6" width="34" height="6" fill="#fff" />
        <rect x="190" y="5" width="38" height="8" fill="#f43f5e" />
        <rect x="12" y="32" width="120" height="16" fill="#111" />
        <rect x="12" y="52" width="96" height="16" fill="#111" />
        <rect x="12" y="76" width="70" height="5" fill="#666" />
        <rect x="12" y="98" width="62" height="16" fill="#f43f5e" stroke="#111" strokeWidth="2" />
        <rect x="16" y="102" width="62" height="16" fill="none" stroke="#111" strokeWidth="2" />
        <rect x="148" y="30" width="80" height="86" fill="#e5e7eb" stroke="#111" strokeWidth="3" />
        <rect x="0" y="126" width="240" height="24" fill="#111" />
        <text x="120" y="142" fontSize="9" fill="#fff" textAnchor="middle" fontWeight="800">
          SALE • SALE • SALE
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 240 150" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="malak-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f5f3ff" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
      </defs>
      <rect width="240" height="150" fill="url(#malak-bg)" />
      <circle cx="210" cy="20" r="34" fill="#ede9fe" />
      <circle cx="30" cy="140" r="26" fill="#ede9fe" />
      <rect x="96" y="10" width="48" height="8" rx="4" fill="#7c3aed" opacity="0.8" />
      <rect x="18" y="40" width="104" height="10" rx="5" fill="#1f2937" />
      <rect x="18" y="56" width="86" height="10" rx="5" fill="#1f2937" />
      <rect x="18" y="76" width="96" height="5" rx="2.5" fill="#9ca3af" />
      <rect x="18" y="86" width="80" height="5" rx="2.5" fill="#9ca3af" />
      <rect x="18" y="104" width="62" height="18" rx="9" fill="#7c3aed" />
      <rect x="140" y="36" width="84" height="88" rx="22" fill="#ddd6fe" />
      <circle cx="182" cy="80" r="22" fill="#c4b5fd" />
    </svg>
  );
}
