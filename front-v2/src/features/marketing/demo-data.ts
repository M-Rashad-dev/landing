/**
 * Sample numbers for the interactive dashboard on the marketing page (a made-up store, «حَبّة»).
 * Generated from a fixed seed, so the server and the browser draw the same thing.
 */

export type DemoPeriod = 7 | 30 | 90;
export const DEMO_PERIODS: DemoPeriod[] = [7, 30, 90];

export type DemoDay = { sales: number; orders: number; label: string };

const DAYS = 180;
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** 180 days ending on a fixed day: weekend peaks, a slow climb, and a few ad bursts. */
export const DEMO_DAYS: DemoDay[] = (() => {
  const rand = seeded(20261113);
  const end = Date.UTC(2026, 10, 13);
  const days: DemoDay[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = new Date(end - i * 86_400_000);
    const weekday = date.getUTCDay();
    const trend = 0.55 + ((DAYS - i) / DAYS) * 0.75;
    const weekend = weekday === 4 || weekday === 5 ? 1.45 : 1;
    const burst = rand() > 0.93 ? 1.9 : 1;
    const orders = Math.max(1, Math.round((6 + rand() * 7) * trend * weekend * burst));
    const basket = 520 + rand() * 380;
    days.push({ orders, sales: Math.round(orders * basket), label: `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}` });
  }
  return days;
})();

export type DemoKpis = { sales: number; orders: number; aov: number; confirm: number; delivered: number; returned: number };

function totals(days: DemoDay[], tilt: number): DemoKpis {
  const sales = days.reduce((s, d) => s + d.sales, 0);
  const orders = days.reduce((s, d) => s + d.orders, 0);
  return { sales, orders, aov: orders ? sales / orders : 0, confirm: 78.6 + tilt, delivered: 71.2 + tilt * 1.4, returned: 6.4 - tilt * 0.5 };
}

/** The period's days and its numbers compared with the period before it. */
export function demoPeriod(period: DemoPeriod) {
  const days = DEMO_DAYS.slice(-period);
  const before = DEMO_DAYS.slice(-period * 2, -period);
  const now = totals(days, period === 7 ? 1.8 : period === 30 ? 0 : -1.2);
  const prev = totals(before, period === 7 ? -0.6 : period === 30 ? -2.1 : -2.8);
  const change = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);
  return {
    days,
    kpis: now,
    deltas: {
      sales: change(now.sales, prev.sales),
      orders: change(now.orders, prev.orders),
      aov: change(now.aov, prev.aov),
      confirm: now.confirm - prev.confirm,
      delivered: now.delivered - prev.delivered,
      returned: now.returned - prev.returned,
    } as Record<keyof DemoKpis, number>,
  };
}

export type DemoStatus = "new" | "confirmed" | "shipped" | "delivered" | "returned";
export type DemoOrder = {
  number: number;
  name: string;
  phone: string;
  items: string;
  city: string;
  carrier: "store" | "company";
  total: number;
  status: DemoStatus;
  source: "store" | "landing";
  time: string;
  duplicate?: boolean;
};

export const DEMO_ORDERS: DemoOrder[] = [
  { number: 1033, name: "أحمد سمير", phone: "0100 123 4567", items: "بن إثيوبي × 2", city: "القاهرة", carrier: "store", total: 685, status: "new", source: "store", time: "منذ 4 دقايق" },
  { number: 1032, name: "نور الهدى", phone: "0111 765 4321", items: "مطحنة حَبّة", city: "الجيزة", carrier: "store", total: 1495, status: "new", source: "landing", time: "منذ 18 دقيقة" },
  { number: 1031, name: "أحمد سمير", phone: "0100 123 4567", items: "بن إثيوبي × 2", city: "القاهرة", carrier: "store", total: 685, status: "new", source: "store", time: "منذ 21 دقيقة", duplicate: true },
  { number: 1030, name: "يوسف خالد", phone: "0122 456 7890", items: "بن برازيلي + كوب زجاج", city: "الإسكندرية", carrier: "company", total: 505, status: "confirmed", source: "store", time: "منذ ساعتين" },
  { number: 1029, name: "سلمى عادل", phone: "0155 222 3344", items: "مطحنة حَبّة + بن إثيوبي", city: "المنصورة", carrier: "company", total: 1714, status: "shipped", source: "landing", time: "امبارح" },
  { number: 1028, name: "كريم فتحي", phone: "0109 888 1122", items: "بن برازيلي × 3", city: "القاهرة", carrier: "store", total: 565, status: "delivered", source: "store", time: "امبارح" },
  { number: 1027, name: "منة الله", phone: "0114 333 9988", items: "مطحنة حَبّة", city: "طنطا", carrier: "company", total: 1515, status: "delivered", source: "landing", time: "من يومين" },
  { number: 1026, name: "عمر حسام", phone: "0128 777 6655", items: "كوب زجاج × 2", city: "أسيوط", carrier: "company", total: 425, status: "returned", source: "store", time: "من 3 أيام" },
];

/** Orders that "arrive" while the visitor watches the hero dashboard. */
export const DEMO_INCOMING: DemoOrder[] = [
  { number: 1034, name: "مريم حسن", phone: "0102 345 6789", items: "مطحنة حَبّة + بن إثيوبي", city: "الجيزة", carrier: "store", total: 1649, status: "new", source: "landing", time: "دلوقتي" },
  { number: 1035, name: "هادي وليد", phone: "0127 654 3210", items: "بن إثيوبي × 3", city: "الإسكندرية", carrier: "company", total: 705, status: "new", source: "store", time: "دلوقتي" },
];
