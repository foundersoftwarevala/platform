/**
 * How many data requests does opening a page make, and how long do they take?
 *
 *   node scripts/ops/chat-request-count.mjs [base] [--login=RESELLER] [--seconds=20] [--path=/chat]
 *
 * One signed-in member opens the page (default /chat) and stays on it. Every request to
 * /rest/v1 and /api is counted by path, with its slowest time, so a burst of
 * duplicate or repeating calls shows up as a number rather than a feeling.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2"); }
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
const LOGIN = (process.argv.find((a) => a.startsWith("--login=")) ?? "--login=RESELLER").slice(8);
const PATH = (process.argv.find((a) => a.startsWith("--path=")) ?? "--path=/chat").slice(7);
const SECONDS = Number((process.argv.find((a) => a.startsWith("--seconds=")) ?? "--seconds=20").slice(10));

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
await page.goto(`${BASE}/login`); await page.waitForTimeout(2500);
await page.fill('input[type="email"]', ops[`SV_LOGIN_${LOGIN}`]); await page.fill('input[type="password"]', ops[`SV_PW_${LOGIN}`] ?? ops.SV_PW_TEST);
await page.click('button[type="submit"]'); await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });

const started = new Map();
const stats = new Map();
page.on("request", (r) => { if (/\/rest\/v1\/|\/api\//.test(r.url())) started.set(r, Date.now()); });
page.on("requestfinished", (r) => {
  const t0 = started.get(r); if (t0 === undefined) return;
  const key = `${r.method()} ${new URL(r.url()).pathname.replace(/^.*\/rest\/v1\//, "rest/")}`;
  const s = stats.get(key) ?? { n: 0, max: 0 }; s.n += 1; s.max = Math.max(s.max, Date.now() - t0); stats.set(key, s);
  started.delete(r);
});
await page.goto(`${BASE}${PATH}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(SECONDS * 1000);
const open = [...started.keys()].filter((r) => !r.url().includes("notifications/stream")).length;
console.log(`  ${LOGIN} on ${PATH} for ${SECONDS}s: ${[...stats.values()].reduce((a, s) => a + s.n, 0)} requests finished, ${open} still open`);
for (const [k, s] of [...stats.entries()].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${String(s.n).padStart(4)}  ${k.padEnd(60)} slowest ${s.max} ms`);
await browser.close();
