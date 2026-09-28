/**
 * Every section of Marketplace Manager, opened from the inside.
 *
 * The console has fifty-nine sections behind one route, reached from the
 * sidebar rather than by address, so an HTTP sweep sees one page and says the
 * module is fine. This signs in, opens each section in turn and reports what an
 * operator would actually find: whether it drew anything, how many controls it
 * has, whether it is showing an error boundary or an empty state, and what the
 * console said while it was open.
 *
 * It changes nothing. Every section is opened and read; no control is clicked,
 * no form is submitted, no row is written.
 *
 *   node scripts/ops/mm-section-scan.mjs            every section
 *   node scripts/ops/mm-section-scan.mjs Products   only sections matching this
 */
import { readFileSync, writeFileSync } from "node:fs";
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
const SITE = (ops.SV_SITE ?? "https://softwarevala.net").replace(/\/$/, "");
// .env.ops keeps the address and the password under separate names, and the
// test.* accounts share one password. The control panel account is the one that
// can open every section.
const EMAIL = ops.SV_LOGIN_CONTROL_PANEL ?? "";
const PASSWORD = ops.SV_PW_CONTROL_PANEL ?? "";
const FILTER = (process.argv[2] ?? "").toLowerCase();

if (!EMAIL || !PASSWORD) {
  console.error("SV_LOGIN_CONTROL_PANEL / SV_PW_CONTROL_PANEL are not set in .env.ops");
  process.exit(1);
}

/** Phrases that mean the section gave up rather than drew. */
const BROKEN = [
  "something went wrong",
  "access restricted",
  "access denied",
  "failed to load",
  "could not load",
  "unable to load",
  "error boundary",
  "unexpected error",
  "not connected",
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

// Sign in once; every section then opens in the same session.
const entry = await context.newPage();
await entry.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
// Let the page hydrate before typing. Filled and submitted before React has
// attached its handler, the form posts as plain HTML and lands back on
// /login? with the credentials dropped — which looks like a rejected sign-in
// and is not one.
await entry.waitForTimeout(4000);
await entry.fill('input[type="email"]', EMAIL);
await entry.fill('input[type="password"]', PASSWORD);
await entry.click('button[type="submit"]');

// Wait for the sign-in to actually land, not for a fixed number of seconds.
// Navigating too early leaves the session unestablished and every section then
// reports "Access restricted", which looks exactly like a permissions defect
// and is not one.
await entry.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await entry.waitForTimeout(3000);

await entry.goto(`${SITE}/marketplace-manager`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await entry.waitForTimeout(8000);

const gate = await entry.locator("h1").first().textContent().catch(() => null);
if (gate && /access restricted/i.test(gate)) {
  console.error(`signed in as ${EMAIL} but Marketplace Manager refused the account.`);
  await browser.close();
  process.exit(1);
}

// The sidebar is the list of sections, taken from the page rather than from a
// copy in this file — a hardcoded list would drift the moment one is added.
//
// The groups collapse, and a collapsed group hides its children, so reading the
// sidebar as it arrives finds fourteen entries where the registry has
// fifty-nine. Everything is expanded first, repeatedly, because expanding one
// group can reveal another.
async function readSidebar() {
  return entry.evaluate(() => {
    const seen = new Set();
    for (const el of document.querySelectorAll("nav button, aside button, [data-sidebar] button")) {
      const t = (el.textContent ?? "").trim();
      if (t && t.length < 40) seen.add(t);
    }
    return [...seen];
  });
}

// A group header and a section entry are told apart by their class, since the
// sidebar carries no aria-expanded: a group is laid out `justify-between` for
// its chevron, a section is a `group/item` row.
for (let pass = 0; pass < 5; pass += 1) {
  const opened = await entry.evaluate(() => {
    let clicked = 0;
    for (const el of document.querySelectorAll("nav button, aside button")) {
      const cls = String(el.className ?? "");
      if (cls.includes("justify-between") && !cls.includes("group/item")) {
        el.click();
        clicked += 1;
      }
    }
    return clicked;
  });
  await entry.waitForTimeout(700);
  if (!opened) break;
  // Clicking a group toggles it, so a second pass would close what the first
  // opened. One pass over the headers is enough; the loop only repeats while
  // new headers keep appearing.
  const nowGroups = await entry.evaluate(
    () =>
      [...document.querySelectorAll("nav button, aside button")].filter((el) =>
        String(el.className ?? "").includes("justify-between"),
      ).length,
  );
  if (nowGroups === opened) break;
}

const labels = (await readSidebar()).filter((l) => l !== "Marketplace Manager");

const wanted = labels.filter((l) => !FILTER || l.toLowerCase().includes(FILTER));
console.log(`${wanted.length} section(s) to open, signed in as ${EMAIL}\n`);

const rows = [];
for (const label of wanted) {
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 160)}`));

  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let status = 0;
  try {
    const res = await page.goto(`${SITE}/marketplace-manager?section=${encodeURIComponent(slug)}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    status = res?.status() ?? 0;
    await page.waitForTimeout(3500);

    // Open the section from the sidebar. ?section= takes a slug the registry
    // knows, and most labels do not map to one — without the click the section
    // is scored on whatever the console opened by default, which is the
    // Dashboard. That is how an earlier run of this script reported fifty-five
    // sections as identical: they were all the Dashboard.
    //
    // The groups start collapsed on every fresh page, so they are expanded
    // again here before the leaf can be found.
    await page.evaluate(() => {
      for (const el of document.querySelectorAll("nav button, aside button")) {
        const cls = String(el.className ?? "");
        if (cls.includes("justify-between") && !cls.includes("group/item")) el.click();
      }
    });
    await page.waitForTimeout(1200);

    const nav = page.locator("nav button, aside button", { hasText: label }).first();
    if (await nav.count()) {
      await nav.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(3000);
    }
  } catch (error) {
    rows.push({ label, status, ok: false, note: `did not open: ${String(error).slice(0, 90)}`, controls: 0, chars: 0, errors });
    await page.close();
    continue;
  }

  const measured = await page.evaluate(() => {
    // The panel beside the sidebar, not the whole document, so the sidebar's
    // own buttons are not counted as the section's controls.
    const main = document.querySelector("main") ?? document.body;
    const head = main.querySelector("h1, h2, h3");
    return {
      heading: (head?.textContent ?? "").trim().slice(0, 60),
      text: (main.innerText ?? "").trim(),
      controls: main.querySelectorAll("button, input, select, textarea, a[href]").length,
      tables: main.querySelectorAll("table").length,
      rows: main.querySelectorAll("tbody tr").length,
    };
  });

  const lower = measured.text.toLowerCase();
  const broken = BROKEN.filter((p) => lower.includes(p));
  const empty = measured.text.length < 120;

  rows.push({
    label,
    status,
    ok: !broken.length && !empty && status === 200,
    note: broken.length ? `shows: ${broken[0]}` : empty ? "drew almost nothing" : "",
    heading: measured.heading,
    controls: measured.controls,
    chars: measured.text.length,
    tableRows: measured.rows,
    errors,
  });
  await page.close();
}

rows.sort((a, b) => Number(a.ok) - Number(b.ok));

for (const r of rows) {
  const flag = r.ok ? "OK  " : "FAIL";
  const detail = [
    r.heading ? `"${r.heading}"` : "",
    `${String(r.chars).padStart(6)} chars`,
    `${String(r.controls).padStart(3)} controls`,
    r.tableRows ? `${r.tableRows} rows` : "",
    r.note,
    r.errors.length ? `${r.errors.length} console error(s)` : "",
  ].filter(Boolean).join("  ");
  console.log(`${flag}  ${r.label.padEnd(26)} ${detail}`);
  for (const e of r.errors.slice(0, 2)) console.log(`        ${e}`);
}

const bad = rows.filter((r) => !r.ok);
console.log(`\nRESULT: ${rows.length - bad.length}/${rows.length} sections drew something usable.`);

writeFileSync("mm-section-scan.json", JSON.stringify(rows, null, 2));
console.log("written: mm-section-scan.json");

await browser.close();
process.exit(bad.length ? 1 : 0);
