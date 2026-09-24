/**
 * Does each button on a page actually do something?
 *
 * Clicks every button in turn and reports what followed: a page change, a
 * request to the server, a dialog, a message on screen, or nothing at all.
 * A button that answers with nothing is the thing this is looking for.
 *
 * The page is reloaded between clicks so one button's effect cannot be
 * mistaken for the next one's.
 *
 *   node scripts/ops/probe-buttons.mjs <path> [ROLE]
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return out;
}

const ops = readEnv(".env.ops");
const site = (ops.SV_SITE ?? "https://softwarevala.net").replace(/\/$/, "");
const path = process.argv[2] ?? "/";
const role = (process.argv[3] ?? "").toUpperCase();

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });

if (role) {
  const page = await context.newPage();
  await page.goto(`${site}/login`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(2500);
  await page.locator('input[type="email"]').fill(ops[`SV_LOGIN_${role}`]);
  await page.locator('input[type="password"]').fill(ops[`SV_PW_${role}`] ?? ops.SV_PW_TEST);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 }).catch(() => {});
  console.log(`signed in as ${role}\n`);
  await page.close();
}

const page = await context.newPage();
await page.goto(site + path, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(5000);

const labels = await page.evaluate(() =>
  [...document.querySelectorAll("button:not([disabled])")]
    .map((b) => (b.textContent ?? "").trim().replace(/\s+/g, " "))
    .filter((t) => t && t.length < 40),
);
const unique = [...new Set(labels)];
console.log(`${path} — ${unique.length} distinct buttons\n`);

const results = [];
for (const label of unique) {
  await page.goto(site + path, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(3500);

  const before = page.url();
  // What the page already showed, so new content counts as an answer.
  const textBefore = await page.evaluate(() => (document.body.innerText ?? "").length);
  const controlsBefore = await page.evaluate(() => document.querySelectorAll("input,textarea,select").length);
  const activeBefore = await page.evaluate(() =>
    [...document.querySelectorAll("[aria-selected='true'],[data-state='active'],.sv-tab-on")]
      .map((e) => (e.textContent ?? "").trim()).join("|"),
  );
  const shapeBefore = await page.evaluate(() => (document.body.innerText ?? "").replace(/s+/g, " "));
  const calls = [];
  const onRequest = (r) => {
    const u = r.url();
    if (/\/api\/|supabase\.co\/(rest|auth|rpc)/.test(u)) calls.push(u.split("?")[0].replace(site, ""));
  };
  page.on("request", onRequest);

  const target = page.getByRole("button", { name: label, exact: true }).first();
  let outcome;
  try {
    // Some buttons only appear on hover, or sit under a sticky bar. Bring the
    // button into view and hover its card first, and click through anything
    // that overlaps rather than reporting the button as unreachable.
    await target.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await target.hover({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    await target.click({ timeout: 6000 }).catch(async () => {
      await target.click({ force: true, timeout: 6000 });
    });
    // A message can come and go, so look early as well as late.
    await page.waitForTimeout(900);
    const earlyToast = await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []);
    await page.waitForTimeout(2600);
    const after = page.url();
    const dialog = await page.locator('[role="dialog"], [data-state="open"]').count();
    const lateToast = await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []);
    const toast = earlyToast.length ? earlyToast : lateToast;
    const textAfter = await page.evaluate(() => (document.body.innerText ?? "").length);
    const controlsAfter = await page.evaluate(() => document.querySelectorAll("input,textarea,select").length);
    const activeAfter = await page.evaluate(() =>
      [...document.querySelectorAll("[aria-selected='true'],[data-state='active'],.sv-tab-on")]
        .map((e) => (e.textContent ?? "").trim()).join("|"),
    );
    const shapeAfter = await page.evaluate(() => (document.body.innerText ?? "").replace(/s+/g, " "));
    if (after !== before) outcome = `went to ${after.replace(site, "")}`;
    else if (toast.length) outcome = `said "${toast[0].slice(0, 44)}"`;
    else if (dialog) outcome = "opened a panel";
    else if (controlsAfter > controlsBefore) outcome = `opened a form (+${controlsAfter - controlsBefore} fields)`;
    else if (Math.abs(textAfter - textBefore) > 40) outcome = `changed the page (${textAfter - textBefore > 0 ? "+" : ""}${textAfter - textBefore} characters)`;
    else if (activeAfter !== activeBefore) outcome = "switched what is showing";
    else if (shapeAfter !== shapeBefore) outcome = "changed what the page says";
    else if (calls.length) outcome = `asked the server (${[...new Set(calls)][0].slice(0, 44)})`;
    else outcome = "NOTHING";
  } catch (error) {
    outcome = `could not click — ${String(error.message ?? error).slice(0, 40)}`;
  }
  page.off("request", onRequest);
  results.push({ label, outcome });
  console.log(`  ${label.padEnd(26)} ${outcome}`);
}

const dead = results.filter((r) => r.outcome === "NOTHING");
console.log(`\n${results.length} buttons tried, ${dead.length} did nothing`);
if (dead.length) for (const d of dead) console.log(`  dead: ${d.label}`);
await browser.close();
