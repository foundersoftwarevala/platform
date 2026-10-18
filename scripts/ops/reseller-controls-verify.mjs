/**
 * Every control on every Reseller Dashboard and Reseller Manager screen, in a
 * real browser: does it do something?
 *
 *   node scripts/ops/reseller-controls-verify.mjs [base] [--only=reseller|manager]
 *
 * Each sidebar section is opened from a fresh page, its controls (buttons,
 * links, tabs, selects, inputs) are listed, and each one is exercised from a
 * fresh copy of that section. A control passes when it produces an effect: a
 * request to the database or the app's API, a navigation, a download, a
 * dialog, or a visible change on the page. A control that produces none is
 * reported as dead.
 *
 * Nothing is written. Every request that could write - a POST server function,
 * any PATCH/PUT/DELETE, an insert into a table, an RPC that is not on the read
 * list below, a POST to the app's API - is blocked in the browser before it
 * leaves, and counted as the control's effect ("write blocked"). On top of
 * that, controls whose label commits something are not clicked (listed as
 * "write" to be traced in code), and every native confirm/prompt is dismissed.
 * A run on 2026-10-01 without the network block changed five reseller plans
 * and cancelled seven test orders through controls that committed instantly;
 * those were restored, and the block exists so it cannot happen again.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2"); }
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7);
const WRITE = /\b(save|submit|delete|remove|approve|reject|pay|payout|terminate|suspend|pause|resume|release|send|upload|activate|deactivate|confirm|buy|purchase|checkout|archive|mark|generate|create|publish|assign|apply|enable|disable|revoke|issue|refund|withdraw|invite|import|sync|retry|reset|update|join|claim|redeem|verify|book|accept|decline|close ticket|escalate|logout|log out|sign out)\b/i;
// RPCs the screens call to read. Anything else is treated as a write.
const SAFE_READS = /\/rpc\/(mm_notifications|mm_resellers|mm_reseller_detail|mm_reseller_attention|ams_recognition_pending|ams_recognition_peek|ams_role_chain|has_role|has_permission|is_participant|[a-z_]*_(list|get|stats|summary|overview|count|peek|search|for))(\?|$)/i;
const isWrite = (method, url) =>
  (url.includes("/_serverFn/") && method === "POST") ||
  (["PATCH", "PUT", "DELETE"].includes(method) && /\/rest\/v1\/|\/api\/|_serverFn/.test(url)) ||
  (method === "POST" && /\/rest\/v1\/(?!rpc\/)/.test(url)) ||
  (method === "POST" && /\/rest\/v1\/rpc\//.test(url) && !SAFE_READS.test(url)) ||
  (method === "POST" && /\/api\//.test(url) && !/\/api\/(track\/ref|notifications\/stream)/.test(url));

let failed = 0;
const results = [];
const check = (name, ok, detail = "") => { if (!ok) failed += 1; console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(78)} ${detail}`); };

async function session(login) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const blocked = [];
  await context.route("**/*", (route) => {
    const r = route.request();
    if (isWrite(r.method(), r.url())) {
      blocked.push(`${r.method()} ${new URL(r.url()).pathname.split("/").slice(-2).join("/").slice(0, 60)}`);
      return route.abort();
    }
    return route.continue();
  });
  const log = { blocked, choosers: 0, requests: [], writes: [], posts: [], errors: [], dialogs: [], downloads: 0, toasts: [] };
  page.on("dialog", (d) => { log.dialogs.push(`${d.type()}: ${d.message().slice(0, 60)}`); d.dismiss().catch(() => {}); });
  page.on("download", () => { log.downloads += 1; });
  page.on("filechooser", () => { log.choosers += 1; });
  page.on("pageerror", (e) => log.errors.push(String(e.message).slice(0, 120)));
  page.on("request", (r) => {
    const u = r.url();
    if (!(u.includes("/rest/v1/") || u.includes("/_serverFn/") || u.includes("/api/"))) return;
    log.requests.push(`${r.method()} ${new URL(u).pathname}`);
    const m = r.method();
    const isRpc = u.includes("/rest/v1/rpc/");
    if (u.includes("/rest/v1/") && !isRpc && ["POST", "PATCH", "PUT", "DELETE"].includes(m)) log.writes.push(`${m} ${new URL(u).pathname}`);
    if (u.includes("/api/") && ["PATCH", "PUT", "DELETE"].includes(m)) log.writes.push(`${m} ${new URL(u).pathname}`);
    // In this app a server function that reads is a GET and one that changes data is a POST.
    if (u.includes("/_serverFn/") && m === "POST") { log.posts.push(new URL(u).pathname.split("/").pop().slice(0, 60)); log.writes.push("POST server function"); }
    if (isRpc && !SAFE_READS.test(u)) log.requests.push(`(rpc ${new URL(u).pathname.split("/").pop()})`);
  });
  await page.goto(`${BASE}/login`); await page.waitForTimeout(2500);
  await page.fill('input[type="email"]', ops[`SV_LOGIN_${login}`]); await page.fill('input[type="password"]', ops[`SV_PW_${login}`] ?? ops.SV_PW_TEST);
  await page.click('button[type="submit"]'); await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  return { browser, page, log };
}
const reset = (log) => { log.requests.length = 0; log.errors.length = 0; log.dialogs.length = 0; log.downloads = 0; log.choosers = 0; };

async function openSection(s, base, text) {
  // A page can start a navigation of its own while loading; try again once it settles.
  for (let attempt = 0; ; attempt += 1) {
    try { await s.page.goto(`${BASE}${base}`, { waitUntil: "domcontentloaded" }); break; }
    catch (e) { if (attempt >= 2) throw e; await s.page.waitForTimeout(2000); }
  }
  await s.page.waitForTimeout(3500);
  if (text) {
    const el = s.page.locator("aside nav button, aside nav a[href]").filter({ hasText: text }).first();
    await el.click({ timeout: 5000 }).catch(() => {});
    await s.page.waitForTimeout(2500);
  }
}

// Controls inside the page's main area, not the shared sidebar or top bar.
const CONTROLS = "main button:visible, main a[href]:visible, main [role=tab]:visible, main select:visible, main input:not([type=hidden]):visible, main textarea:visible";
async function listControls(page) {
  return page.locator(CONTROLS).evaluateAll((els) => els.map((e, i) => ({
    i,
    tag: e.tagName.toLowerCase(),
    type: e.getAttribute("type") || "",
    role: e.getAttribute("role") || "",
    label: ((e.getAttribute("aria-label") || e.textContent || e.getAttribute("placeholder") || e.getAttribute("title") || e.getAttribute("name") || "").trim().replace(/\s+/g, " ")).slice(0, 60),
    href: e.getAttribute("href") || "",
    disabled: e.disabled === true || e.getAttribute("aria-disabled") === "true",
    selected: ["true", "page"].includes(e.getAttribute("aria-pressed") ?? "") || ["true", "page"].includes(e.getAttribute("aria-current") ?? "") || e.getAttribute("aria-selected") === "true" || ["active", "on", "checked", "open"].includes(e.getAttribute("data-state") ?? ""),
  })));
}

async function exercise(s, base, section, c) {
  const { page, log } = s;
  await openSection(s, base, section);
  const loc = page.locator(CONTROLS).nth(c.i);
  if (!(await loc.count())) return { effect: "control gone after reload" };
  await page.evaluate(() => {
    window.__svMut = 0;
    const root = document.querySelector("main") || document.body;
    window.__svObs?.disconnect?.();
    window.__svObs = new MutationObserver((m) => { window.__svMut += m.length; });
    window.__svObs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    void root;
  });
  reset(log);
  const blockedBefore = log.blocked.length;
  const urlBefore = page.url();
  try {
    if (c.tag === "select") {
      const values = await loc.evaluate((e) => [...e.options].map((o) => o.value));
      const current = await loc.inputValue();
      const next = values.find((v) => v !== current);
      if (next === undefined) return { effect: "select with one option" };
      await loc.selectOption(next, { timeout: 4000 });
    } else if (c.tag === "input" && !["checkbox", "radio", "button", "submit", "file"].includes(c.type) || c.tag === "textarea") {
      await loc.fill("a", { timeout: 4000 });
      await page.waitForTimeout(1200);
      await loc.fill("", { timeout: 4000 }).catch(() => {});
    } else {
      await loc.click({ timeout: 4000 });
    }
  } catch (e) { return { effect: `could not operate: ${String(e.message).split("\n")[0].slice(0, 60)}` }; }
  await page.waitForTimeout(2200);
  const mut = await page.evaluate(() => window.__svMut || 0).catch(() => -1);
  const effects = [];
  if (page.url() !== urlBefore) effects.push(`navigates to ${new URL(page.url()).pathname}`);
  if (log.requests.length) effects.push(`${log.requests.length} request(s) ${[...new Set(log.requests)].slice(0, 2).join(" ")}`);
  if (log.downloads) effects.push("download");
  if (log.choosers) effects.push("file chooser");
  if (log.blocked.length > blockedBefore) effects.push(`write blocked (${log.blocked.slice(blockedBefore).join(", ")})`);
  if (log.dialogs.length) effects.push(`dialog (${log.dialogs[0]})`);
  if (mut > 0) effects.push(`page changed (${mut})`);
  return { effect: effects.join("; ") || "", errors: [...log.errors] };
}

async function auditArea(login, base, label) {
  const s = await session(login);
  await openSection(s, base, null);
  // The sidebar renders after the session settles; wait for it rather than a fixed pause.
  await s.page.locator("aside nav button, aside nav a[href]").first().waitFor({ timeout: 30000 }).catch(() => {});
  const sections = [...new Set(await s.page.locator("aside nav button, aside nav a[href]").evaluateAll((els) =>
    els.map((e) => (e.textContent || "").trim().replace(/\s+/g, " ")).filter((t) => t && t.length < 50 && !/log ?out|sign ?out/i.test(t))))];
  console.log(`  ..    ${label}: ${sections.length} sections`);
  check(`${label}: the sidebar lists its sections`, sections.length > 0, `${sections.length} at ${new URL(s.page.url()).pathname}`);
  for (const section of sections) {
    await openSection(s, base, section);
    // A sidebar entry that leaves this area (Explore and Marketplace open the
    // public catalogue) is checked for where it goes, not crawled.
    const landed = new URL(s.page.url()).pathname;
    if (!landed.startsWith(base)) {
      check(`${label} › ${section}: opens ${landed}`, true, "leaves the dashboard; not crawled here");
      results.push({ area: label, section, verdict: `navigates to ${landed}` });
      continue;
    }
    const controls = await listControls(s.page);
    let dead = 0, writes = 0, exercised = 0;
    for (const c of controls) {
      if (c.disabled) { results.push({ area: label, section, ...c, verdict: "disabled" }); continue; }
      // Switches and checkboxes usually persist a setting the moment they flip.
      if (((c.tag === "button" || c.role === "tab" || c.tag === "a") && WRITE.test(c.label)) || c.role === "switch" || c.type === "checkbox") {
        writes += 1; results.push({ area: label, section, ...c, verdict: "write (not clicked)" }); continue;
      }
      if (c.tag === "a" && /^(https?:|mailto:|tel:)/.test(c.href) && !c.href.startsWith(BASE)) { results.push({ area: label, section, ...c, verdict: `external link ${c.href.slice(0, 50)}` }); continue; }
      const r = await exercise(s, base, section, c);
      exercised += 1;
      // Choosing what is already chosen changes nothing, and should not.
      if (r.effect === "" && c.selected) { results.push({ area: label, section, ...c, verdict: "already selected (no change expected)" }); continue; }
      const isDead = r.effect === "";
      if (isDead) dead += 1;
      results.push({ area: label, section, ...c, verdict: isDead ? "DEAD" : r.effect, errors: r.errors });
      if (isDead) console.log(`  DEAD  ${label} › ${section} › ${c.tag}${c.type ? `[${c.type}]` : ""} "${c.label}"`);
      if (r.errors?.length) console.log(`  ERR   ${label} › ${section} › "${c.label}": ${r.errors[0]}`);
    }
    check(`${label} › ${section}: no dead controls`, dead === 0, `${controls.length} controls, ${exercised} exercised, ${writes} write, ${dead} dead`);
  }
  check(`${label}: nothing was written while exercising controls`, s.log.writes.length === 0, s.log.writes.slice(0, 3).join(", "));
  console.log(`  ..    ${label}: writes blocked in the browser: ${[...new Set(s.log.blocked)].join(", ") || "none"}`);
  await s.browser.close();
}

try {
  if (ONLY !== "manager") await auditArea("RESELLER", "/dashboard/reseller", "reseller");
  if (ONLY !== "reseller") await auditArea("ADMIN", "/reseller-manager", "manager");
} catch (error) {
  failed += 1;
  console.log(`  FAIL  the run stopped: ${error instanceof Error ? error.message.slice(0, 300) : error}`);
}
writeFileSync(`${process.env.TEMP}/reseller-controls.json`, JSON.stringify(results, null, 1));
console.log(`\n  ${results.length} controls recorded in %TEMP%/reseller-controls.json`);
console.log(`  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
