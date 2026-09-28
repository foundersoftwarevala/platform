/**
 * The influencer portal, signed in as an influencer, checked against the rows
 * that influencer actually has.
 *
 *   node scripts/ops/_verify-influencer-portal.mjs
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = "https://softwarevala.net";

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
const bad = [];
p.on("response", async (r) => {
  if (r.status() >= 400) {
    let t = "";
    try { t = (await r.text()).slice(0, 140); } catch {}
    bad.push(`${r.status()} ${r.url().replace(SITE, "").slice(0, 80)} ${t}`);
  }
});
p.on("pageerror", (e) => bad.push(`pageerror ${String(e).slice(0, 120)}`));

await p.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(4000);
await p.fill('input[type="email"]', ops.SV_LOGIN_INFLUENCER);
await p.fill('input[type="password"]', ops.SV_PW_TEST);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45000 });
await p.waitForTimeout(2000);

// The endpoint itself, with this account's own token.
const api = await p.evaluate(async () => {
  const raw = Object.keys(localStorage).find((k) => k.includes("auth-token"));
  const token = raw ? JSON.parse(localStorage.getItem(raw)).access_token : null;
  const r = await fetch("/api/influencer/metrics", { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, body: (await r.text()).slice(0, 400) };
});
console.log("  /api/influencer/metrics ->", api.status, api.body);

bad.length = 0;
await p.goto(`${SITE}/dashboard/influencer`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(12000);

const cards = await p.evaluate(() =>
  [...document.querySelectorAll("button")]
    .map((el) => (el.innerText || "").trim().split("\n").filter(Boolean))
    .filter((lines) => lines.length >= 2 && /^(Followers|Campaigns|Brands|Content|Revenue|Engagement)$/.test(lines[1]))
    .map((lines) => `${lines[1]}=${lines[0]} (${lines[2] ?? ""})`),
);
cards.forEach((c) => console.log("  card ", c));
bad.slice(0, 4).forEach((x) => console.log("  failed:", x));
await b.close();
