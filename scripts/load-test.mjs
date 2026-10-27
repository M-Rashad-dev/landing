// Simple load test (PLAN phase 11, C.3) against the running stack (tools/start-dev.sh):
//   node scripts/load-test.mjs [--visitors 50] [--rounds 10] [--orders-per-second 10] [--seconds 10]
// Creates its own store + published page, then:
//   1. 50 concurrent visitors × 10 rounds on the public page → no errors;
//   2. 10 orders / second for 10 seconds (each from its own IP and phone) → no 5xx, unique numbers.
// Node cannot resolve *.localhost on every OS, so requests go to 127.0.0.1 with the Host header set.
import http from "node:http";
import { randomUUID } from "node:crypto";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []));
const PORT = Number(process.env.PUBLIC_PORT ?? 3000);
const APP = `app.localhost:${PORT}`;
const VISITORS = Number(args.visitors ?? 50);
const ROUNDS = Number(args.rounds ?? 10);
const ORDERS_PER_SECOND = Number(args["orders-per-second"] ?? 10);
const SECONDS = Number(args.seconds ?? 10);
const agent = new http.Agent({ keepAlive: true, maxSockets: 256 });

function request(host, method, path, { body, headers = {}, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port: PORT,
        method,
        path,
        agent,
        headers: {
          Host: host,
          Origin: `http://${APP}`,
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            // HTML or empty body.
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, text, json });
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(30_000, () => req.destroy(new Error(`timeout ${method} ${host}${path}`)));
    if (payload) req.write(payload);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};
const percentile = (values, p) => values.slice().sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor((p / 100) * values.length))];

// --- Setup: account, product, published page -------------------------------------------------
const stamp = Date.now();
const reg = await request(APP, "POST", "/api/auth/register", {
  body: { name: "Load Test", email: `load${stamp}@example.com`, phone: `015${String(stamp).slice(-8)}`, store_name: "Load Store", password: "secret-pass-1", password_confirmation: "secret-pass-1" },
});
if (reg.status !== 201) fail(`register ${reg.status} ${reg.text.slice(0, 200)} (run php artisan cache:clear to reset the register limit)`);
const cookie = String(reg.headers["set-cookie"]?.[0] ?? "").split(";")[0];
const siteHost = `${reg.json.data.domain.host}:${PORT}`;
const bff = (method, path, body) => request(APP, method, `/api/bff${path}`, { body, cookie });

const product = await bff("POST", "/dashboard/products", { name: "Load Mug", price: "120" });
if (product.status !== 201) fail(`product ${product.status}`);
const page = await bff("POST", "/dashboard/pages", {
  title: "Load page",
  slug: "load",
  theme_key: "malak",
  product_id: product.json.data.id,
  content: { version: 1, sections: [
    { id: randomUUID(), type: "hero", variant: "split", visible: true, props: { title: "Load test" } },
    { id: randomUUID(), type: "order_form", variant: "card", visible: true, props: {} },
  ] },
});
if (page.status !== 201) fail(`page ${page.status} ${page.text.slice(0, 200)}`);
const published = await bff("POST", `/dashboard/pages/${page.json.data.id}/publish`, {});
if (published.status !== 200) fail(`publish ${published.status}`);
console.log(`store: http://${siteHost}/load`);

// --- 1. Concurrent visitors -----------------------------------------------------------------
const visitTimes = [];
const visitErrors = [];
const visitStart = Date.now();
for (let round = 0; round < ROUNDS; round++) {
  await Promise.all(
    Array.from({ length: VISITORS }, async () => {
      const t0 = performance.now();
      const res = await request(siteHost, "GET", "/load").catch((e) => ({ status: 0, text: String(e) }));
      visitTimes.push(performance.now() - t0);
      if (res.status !== 200 || !res.text.includes("Load test")) visitErrors.push(res.status);
    }),
  );
}
const visitSeconds = (Date.now() - visitStart) / 1000;
console.log(
  `visitors: ${VISITORS} concurrent × ${ROUNDS} rounds = ${visitTimes.length} requests in ${visitSeconds.toFixed(1)} s ` +
    `(${(visitTimes.length / visitSeconds).toFixed(0)} req/s), p50 ${percentile(visitTimes, 50).toFixed(0)} ms, p95 ${percentile(visitTimes, 95).toFixed(0)} ms, errors ${visitErrors.length}`,
);
if (visitErrors.length > 0) fail(`page errors: ${[...new Set(visitErrors)].join(", ")}`);

// --- 2. Orders at a steady rate -----------------------------------------------------------------
const total = ORDERS_PER_SECOND * SECONDS;
const ip = (i) => `10.${Math.floor(i / 250) % 250}.${i % 250}.${(stamp % 200) + 1}`;
// Tokens first (each from its own IP: 30 / minute / IP), then wait past the 3 s minimum age.
const tokens = await Promise.all(
  Array.from({ length: total }, async (_, i) => {
    const res = await request(siteHost, "GET", "/api/public/form-token?slug=load", { headers: { "X-Forwarded-For": ip(i) } });
    if (res.status !== 200) fail(`form token ${res.status}`);
    return res.json.data.token;
  }),
);
await sleep(3500);

const orderTimes = [];
const statuses = {};
const numbers = [];
const inFlight = [];
const orderStart = Date.now();
for (let i = 0; i < total; i++) {
  const due = orderStart + (i * 1000) / ORDERS_PER_SECOND;
  await sleep(Math.max(0, due - Date.now()));
  inFlight.push(
    (async () => {
      const t0 = performance.now();
      const res = await request(siteHost, "POST", "/api/public/orders", {
        headers: { "X-Forwarded-For": ip(i) },
        body: {
          slug: "load",
          quantity: 1,
          options: {},
          code: null,
          customer: { name: `Load ${i}`, phone: `012${String(10_000_000 + ((stamp + i * 7919) % 89_999_999)).padStart(8, "0")}`, governorate: "القاهرة", address: "Load street" },
          answers: {},
          form_token: tokens[i],
          website: "",
          idempotency_key: randomUUID(),
        },
      }).catch((e) => ({ status: 0, text: String(e) }));
      orderTimes.push(performance.now() - t0);
      statuses[res.status] = (statuses[res.status] ?? 0) + 1;
      if (res.status === 201) numbers.push(res.json.data.order_number);
    })(),
  );
}
await Promise.all(inFlight);
const orderSeconds = (Date.now() - orderStart) / 1000;
const unique = new Set(numbers).size;
console.log(
  `orders: ${total} at ${ORDERS_PER_SECOND}/s in ${orderSeconds.toFixed(1)} s, statuses ${JSON.stringify(statuses)}, ` +
    `p50 ${percentile(orderTimes, 50).toFixed(0)} ms, p95 ${percentile(orderTimes, 95).toFixed(0)} ms, numbers ${numbers.length} (${unique} unique)`,
);
if (Object.keys(statuses).some((s) => Number(s) >= 500 || Number(s) === 0)) fail("server errors during orders");
if (unique !== numbers.length) fail("duplicate order numbers");
if (numbers.length !== total) fail(`only ${numbers.length} of ${total} orders were accepted`);
const sorted = numbers.slice().sort((a, b) => a - b);
if (sorted[0] !== 1001 || sorted.at(-1) !== 1000 + total) fail(`numbers are not 1001..${1000 + total}`);

console.log("OK: load test passed");
agent.destroy();
