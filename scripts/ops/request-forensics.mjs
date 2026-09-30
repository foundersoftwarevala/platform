/**
 * Every API and database request a Control Panel route makes, with its real
 * outcome, in a browser that blocks nothing.
 *
 * The Control Panel scan aborts every non-GET request while it presses buttons
 * (so it never writes), and an aborted request is reported as a failure. This
 * opens each route as a given account with no interception at all, waits, and
 * prints each request that did not succeed: method, path, status or network
 * error, and the response body's error text - so a failure can be told apart
 * from the scan's own blocking.
 *
 *   node scripts/ops/request-forensics.mjs [base] [--as=CONTROL_PANEL] /route ...
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
const AS = (process.argv.find((a) => a.startsWith("--as=")) ?? "--as=CONTROL_PANEL").slice(5);
const ROUTES = process.argv.slice(2).filter((a) => a.startsWith("/"));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(3500);
await page.fill('input[type="email"]', ops[`SV_LOGIN_${AS}`]);
await page.fill('input[type="password"]', ops[`SV_PW_${AS}`] ?? ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });

for (const route of ROUTES) {
  const seen = [];
  let total = 0;
  const onResponse = async (r) => {
    const url = r.url();
    if (!/\/(rest|auth|storage|functions)\/v1\/|\/api\/|\/_serverFn\//.test(url)) return;
    total += 1;
    if (r.status() < 400) return;
    const body = await r.text().catch(() => "");
    seen.push(`${r.status()} ${r.request().method()} ${url.replace(BASE, "").replace(/^https?:\/\/[^/]+/, "").split("?")[0]}  ${body.slice(0, 140).replace(/\s+/g, " ")}`);
  };
  const onFailed = (r) => {
    const url = r.url();
    if (!/\/(rest|auth|storage|functions)\/v1\/|\/api\/|\/_serverFn\//.test(url)) return;
    seen.push(`NETWORK ${r.method()} ${url.replace(BASE, "").replace(/^https?:\/\/[^/]+/, "").split("?")[0]}  ${r.failure()?.errorText ?? ""}`);
  };
  page.on("response", onResponse);
  page.on("requestfailed", onFailed);
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(9000);
  page.off("response", onResponse);
  page.off("requestfailed", onFailed);
  console.log(`\n${route}  as ${AS}  requests=${total}  not ok=${seen.length}`);
  for (const line of seen) console.log(`  ${line}`);
}
await browser.close();
