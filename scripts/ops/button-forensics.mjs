/**
 * What one button really does, recorded rather than guessed.
 *
 * For each route + button label: sign in, open the route, press the button and
 * record everything that follows - a native file picker, a download (with its
 * file name and size), a dialog, a navigation, a toast, the requests it made
 * (writes are stopped and recorded, never sent), and how the page's text
 * changed. A scan that sees "nothing changed" cannot tell a file picker or a
 * download from a dead button; this can.
 *
 *   node scripts/ops/button-forensics.mjs [base] [--as=ACCOUNT] [--live] "/route::Label[::nth]" ...
 *
 * --live lets writes through, for an action whose effect is the write itself
 * (a refresh that recomputes and stores); use it only on actions safe to run.
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
const LIVE = process.argv.includes("--live");
const CASES = process.argv.slice(2).filter((a) => a.includes("::")).map((a) => {
  const [route, label, nth] = a.split("::");
  return { route, label, nth: Number(nth ?? 0) };
});

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(3500);
await page.fill('input[type="email"]', ops[`SV_LOGIN_${AS}`]);
await page.fill('input[type="password"]', ops[`SV_PW_${AS}`] ?? ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });

let log = null;
await context.route("**/*", (route) => {
  const r = route.request();
  const read = ["GET", "HEAD", "OPTIONS"].includes(r.method()) || /\/auth\/v1\/(token|user)/.test(r.url());
  const api = /\/(rest|auth|storage|functions)\/v1\/|\/api\/|\/_serverFn\//.test(r.url());
  if (log && api) log.requests.push(`${read || LIVE ? "" : "STOPPED "}${r.method()} ${r.url().replace(BASE, "").replace(/^https?:\/\/[^/]+/, "").split("?")[0]}`);
  if (log && !read && !LIVE) return route.abort();
  return route.continue();
});

for (const c of CASES) {
  await page.goto(`${BASE}${c.route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(7000);
  const button = page.getByRole("button", { name: c.label, exact: true }).nth(c.nth);
  const count = await page.getByRole("button", { name: c.label, exact: true }).count();
  const pressed = await button.getAttribute("aria-pressed").catch(() => null);
  const selected = await button.getAttribute("aria-selected").catch(() => null);
  const state = await button.getAttribute("data-state").catch(() => null);
  const classes = (await button.getAttribute("class").catch(() => "")) ?? "";
  const before = await page.locator("body").innerText().catch(() => "");
  const url = page.url();
  log = { requests: [] };
  const events = [];
  const onChooser = () => events.push("FILE-PICKER opened");
  const onDownload = async (d) => events.push(`DOWNLOAD ${d.suggestedFilename()}`);
  const onDialog = (d) => { events.push(`NATIVE-DIALOG ${d.type()}: ${d.message().slice(0, 80)}`); d.dismiss().catch(() => undefined); };
  page.on("filechooser", onChooser);
  page.on("download", onDownload);
  page.on("dialog", onDialog);
  const clicked = count ? await button.click({ timeout: 5000 }).then(() => true).catch((e) => `click failed: ${String(e.message).slice(0, 80)}`) : "not found";
  await page.waitForTimeout(2500);
  page.off("filechooser", onChooser);
  page.off("download", onDownload);
  page.off("dialog", onDialog);
  const after = await page.locator("body").innerText().catch(() => "");
  const toasts = await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []);
  const dialogs = await page.locator("[role=dialog], [role=alertdialog]").count();
  const added = after.split("\n").filter((l) => l.trim() && !before.includes(l)).slice(0, 4);
  log.requests = [...new Set(log.requests)];
  console.log(`\n${c.route} :: "${c.label}"${c.nth ? ` #${c.nth}` : ""}  (${count} match)`);
  console.log(`  state before: aria-pressed=${pressed} aria-selected=${selected} data-state=${state} active-class=${/bg-primary|active|selected|bg-secondary|ring|text-white/.test(classes)}`);
  console.log(`  clicked=${clicked}  url ${page.url() === url ? "unchanged" : `-> ${page.url().replace(BASE, "")}`}  dialogs=${dialogs}`);
  for (const e of events) console.log(`  ${e}`);
  if (toasts.length) console.log(`  TOAST ${toasts.join(" | ").replace(/\s+/g, " ").slice(0, 200)}`);
  if (log.requests.length) console.log(`  requests: ${log.requests.join(" ; ").slice(0, 300)}`);
  console.log(`  text: ${before === after ? "unchanged" : `changed; new lines: ${JSON.stringify(added).slice(0, 240)}`}`);
  log = null;
}
await browser.close();
