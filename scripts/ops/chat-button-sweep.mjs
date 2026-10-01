/**
 * Every screen in the app, opened in a browser as a signed-in operator:
 * does it show the internal chat button?
 *
 *   node scripts/ops/chat-button-sweep.mjs [base] [--login CONTROL_PANEL]
 *
 * Routes come from the generated route tree (the app's own list), with every
 * role dashboard expanded. For each: where it ended up, whether it rendered a
 * working screen, whether it has a top bar, and whether the chat button is in
 * it. Writes chat-button-sweep.json. Read-only.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
const loginAt = process.argv.indexOf("--login");
const LOGIN = loginAt >= 0 ? process.argv[loginAt + 1] : "CONTROL_PANEL";

const tree = readFileSync("src/routeTree.gen.ts", "utf8");
const ROLE_KEYS = ["author", "vendor", "reseller", "affiliate", "influencer", "franchise", "seo", "admin", "developer", "dev-manager", "promise-tracker"];
const routes = [...new Set([...tree.matchAll(/fullPath: '([^']*)'/g)].map((m) => m[1]))]
  .filter((p) => !p.startsWith("/api/") && !p.includes("$") && !/\.(xml|txt)$/.test(p))
  .concat(ROLE_KEYS.map((r) => `/dashboard/${r}`))
  .sort();

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(3000);
await page.fill('input[type="email"]', ops[`SV_LOGIN_${LOGIN}`]);
await page.fill('input[type="password"]', ops[`SV_PW_${LOGIN}`] ?? ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });

const results = [];
for (const route of routes) {
  const errors = [];
  const onError = (e) => errors.push(String(e.message ?? e));
  page.on("pageerror", onError);
  let status = 0;
  try {
    const res = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    status = res?.status() ?? 0;
    await page.waitForTimeout(3500);
  } catch (e) {
    errors.push(`navigation: ${String(e.message ?? e).slice(0, 80)}`);
  }
  const probe = await page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    const header = document.querySelector("header, [role='banner']");
    const r = header?.getBoundingClientRect();
    return {
      finalPath: location.pathname,
      restricted: /access restricted|not authori[sz]ed|sign in to continue|you do not have access/i.test(text),
      notFound: /page not found|404/i.test(text.slice(0, 400)),
      hasTopBar: Boolean(header && r && r.top < 120 && r.height > 20 && r.height < 200),
      chatButtons: document.querySelectorAll("[data-chat-app-button]").length,
      title: (document.querySelector("h1")?.textContent ?? document.title ?? "").trim().slice(0, 60),
    };
  }).catch(() => ({ finalPath: "?", restricted: false, notFound: false, hasTopBar: false, chatButtons: 0, title: "" }));
  page.off("pageerror", onError);
  results.push({ route, status, ...probe, errors: errors.slice(0, 2) });
  process.stdout.write(`${probe.chatButtons ? "C" : probe.hasTopBar ? "-" : "."}`);
}
await browser.close();
writeFileSync("chat-button-sweep.json", JSON.stringify(results, null, 2));

const withButton = results.filter((r) => r.chatButtons > 0);
const barNoButton = results.filter((r) => r.chatButtons === 0 && r.hasTopBar && !r.restricted && !r.notFound && r.finalPath === r.route);
const duplicated = results.filter((r) => r.chatButtons > 1);
console.log(`\n\n  routes ${results.length}, with chat button ${withButton.length}, top bar without it ${barNoButton.length}, more than one ${duplicated.length}`);
for (const r of barNoButton) console.log(`  NO BUTTON  ${r.route.padEnd(44)} ${r.title}`);
for (const r of duplicated) console.log(`  TWICE      ${r.route.padEnd(44)} ${r.chatButtons}`);
