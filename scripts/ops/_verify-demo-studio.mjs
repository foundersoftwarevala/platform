/**
 * The Demo Studio tabs, read as an operator, against what the VPS holds.
 *
 * The point of the check: hosted Supabase holds one product_demo_urls row and
 * the VPS holds seventeen, so a screen showing "1" is reading the wrong
 * database and a screen showing "17" is reading the right one.
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
const p = await (await b.newContext({ viewport: { width: 1600, height: 1100 } })).newPage();
const failed = [];
p.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(SITE, "").slice(0, 70)}`); });
p.on("pageerror", (e) => failed.push(`pageerror ${String(e).slice(0, 90)}`));

await p.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await p.waitForTimeout(4000);
await p.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await p.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await p.waitForTimeout(2000);

await p.goto(`${SITE}/product-demo-manager`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await p.waitForTimeout(12_000);

const read = async (label) => {
  failed.length = 0;
  if (label) {
    await p.locator("button, a").filter({ hasText: new RegExp(`^\\s*${label}\\s*$`, "i") }).first()
      .click({ timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(8000);
  }
  return p.evaluate(() => {
    const text = document.body.innerText || "";
    // Every prominent figure on the screen, in order.
    const figures = [...document.querySelectorAll("p,span,div")]
      .map((e) => (e.className || "").toString().includes("text-2xl") ? (e.textContent || "").trim() : null)
      .filter((v) => v && /^[0-9,.\-]+$/.test(v));
    return {
      figures: figures.slice(0, 8),
      heading: (document.querySelector("h1")?.textContent ?? "").trim(),
      rows: document.querySelectorAll("tbody tr").length,
      problem: (text.match(/(could not|failed to|unauthori[sz]ed|not permitted)[^\n]{0,60}/i) ?? [])[0] ?? null,
    };
  });
};

for (const [label, note] of [
  ["", "Product Dashboard (landing)"],
  ["Product List", "demo count per product"],
  ["Analytics", "audit totals"],
]) {
  const s = await read(label);
  console.log(`  ${(note).padEnd(30)} [${s.heading}] figures=${JSON.stringify(s.figures)} rows=${s.rows}` +
    `${s.problem ? ` «${s.problem}»` : ""}${failed.length ? ` failed=${failed[0]}` : ""}`);
}

await b.close();
