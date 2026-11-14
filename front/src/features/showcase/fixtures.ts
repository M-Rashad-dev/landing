import type { OrderStatus } from "@/components/domain/order-status";

/**
 * Display data for /dashboard/components ONLY (like the old /dev/themes fixtures).
 * Never imported by a real screen; real screens read the API.
 */

/** Deterministic pseudo-random so the page looks the same on every load (no hydration drift). */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export const DEMO_GOVERNORATES = ["القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "المنوفية", "أسيوط", "سوهاج"];

const NAMES = ["محمد سامي", "سارة أحمد", "منى حسن", "عمر خالد", "هبة مصطفى", "يوسف علي", "نورهان طارق", "إسلام رضا", "دينا محمود", "كريم عادل", "ياسمين فؤاد", "أحمد جمال"];
const PRODUCTS = ["ساعة ذكية رياضية", "تيشيرت قطن", "حزام جلد", "شنطة كتف", "سماعة بلوتوث", "كوباية سيراميك"];
const STATUSES: OrderStatus[] = ["new", "confirmed", "delivered", "confirmed", "new", "returned", "cancelled", "delivered", "fake", "damaged"];

export type DemoOrder = {
  id: number;
  number: number;
  customer: string;
  phone: string;
  governorate: string;
  product: string;
  extra: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  source: "store" | "landing";
};

export const DEMO_ORDERS: DemoOrder[] = (() => {
  const rnd = seeded(7);
  const base = Date.UTC(2026, 10, 11, 13, 29);
  return Array.from({ length: 34 }, (_, i) => ({
    id: i + 1,
    number: 1028 - i,
    customer: NAMES[i % NAMES.length],
    phone: `010${String(40000000 + Math.floor(rnd() * 59999999)).padStart(8, "0")}`,
    governorate: DEMO_GOVERNORATES[Math.floor(rnd() * DEMO_GOVERNORATES.length)],
    product: PRODUCTS[Math.floor(rnd() * PRODUCTS.length)],
    extra: rnd() > 0.7 ? 1 + Math.floor(rnd() * 3) : 0,
    total: Math.round((250 + rnd() * 1400) / 10) * 10,
    status: STATUSES[i % STATUSES.length],
    createdAt: new Date(base - i * 9.7 * 3600 * 1000).toISOString(),
    source: rnd() > 0.4 ? "store" : "landing",
  }));
})();

export type DemoDay = { date: string; sales: number; orders: number; cancelled: number };

export const DEMO_DAYS: DemoDay[] = (() => {
  const rnd = seeded(21);
  const end = Date.UTC(2026, 10, 11);
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(end - (29 - i) * 86400000).toISOString().slice(0, 10);
    const orders = Math.round(4 + rnd() * 14 + i * 0.3);
    return { date: d, orders, cancelled: Math.round(orders * (0.05 + rnd() * 0.15)), sales: orders * Math.round(380 + rnd() * 260) };
  });
})();

export const DEMO_EMPTY_DAYS: DemoDay[] = DEMO_DAYS.map((d) => ({ ...d, sales: 0, orders: 0, cancelled: 0 }));

export const DEMO_CATEGORIES = [
  { id: "1", name: "رجالي", depth: 0, count: 24 },
  { id: "2", name: "قمصان", depth: 1, count: 9 },
  { id: "3", name: "بناطيل", depth: 1, count: 6 },
  { id: "4", name: "حريمي", depth: 0, count: 31 },
  { id: "5", name: "فساتين", depth: 1, count: 12 },
  { id: "6", name: "إكسسوارات", depth: 0, count: 15 },
];

export const DEMO_CATEGORY_OPTIONS = DEMO_CATEGORIES.map((c) => ({ value: c.id, label: c.name }));

/** Plain SVG data images (no network) for thumbnails and media tiles. */
function swatch(hue: number, label: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='hsl(${hue} 70% 92%)'/><circle cx='100' cy='88' r='42' fill='hsl(${hue} 65% 62%)'/><rect x='52' y='140' width='96' height='14' rx='7' fill='hsl(${hue} 50% 45%)' opacity='.5'/><text x='100' y='96' font-size='26' text-anchor='middle' fill='white' font-family='sans-serif'>${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const DEMO_IMAGES = [
  { id: 1, url: swatch(24, "1") },
  { id: 2, url: swatch(200, "2") },
  { id: 3, url: swatch(150, "3") },
];

export const DEMO_THUMB = swatch(24, "");
export const DEMO_THEME_COVER = swatch(30, "");
