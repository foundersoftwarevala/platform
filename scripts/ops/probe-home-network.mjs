/**
 * What the home page is still doing after it has finished loading.
 *
 * probe-console.mjs reports `/` as the one page on the site that never reaches
 * networkidle — it times out at ninety seconds while every other page settles.
 * A page that never goes quiet is either polling, or retrying something that
 * keeps failing, and from the outside those look identical. This tells them
 * apart: it records every request the page makes for a fixed window, then
 * groups them by URL so a request made once is separated from one made forty
 * times.
 *
 * It also records the status, because the most likely cause of a page that will
 * not settle is a client retrying a request that is being refused.
 *
 *   node scripts/ops/probe-home-network.mjs [path] [seconds]
 *   node scripts/ops/probe-home-network.mjs / 25
 */
import { chromium } from "@playwright/test";

const SITE = (process.env.SV_SITE || "https://softwarevala.net").replace(/\/+$/, "");
const PATHNAME = process.argv[2] || "/";
const SECONDS = Number(process.argv[3] || 25);

/** Collapse the noise: one line per endpoint, not per request. */
function endpointOf(url) {
  try {
    const u = new URL(url);
    if (u.origin !== SITE) return `${u.origin}${u.pathname}`;
    // Query strings on /rest/v1/ carry the filters, which is exactly what
    // distinguishes one failing call from another, so the first is kept.
    if (u.pathname.startsWith("/rest/v1/")) {
      const table = u.pathname.replace("/rest/v1/", "").split("?")[0];
      return `/rest/v1/${table}`;
    }
    return u.pathname;
  } catch {
    return url;
  }
}

const browser = await chromium.launch();
const page = await browser.newPage();

const calls = new Map();
const note = (url, status) => {
  const key = endpointOf(url);
  const row = calls.get(key) ?? { count: 0, statuses: new Map() };
  row.count += 1;
  row.statuses.set(status, (row.statuses.get(status) ?? 0) + 1);
  calls.set(key, row);
};

page.on("response", (r) => note(r.url(), r.status()));
page.on("requestfailed", (r) => note(r.url(), `failed: ${r.failure()?.errorText ?? "?"}`));

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
});

console.log(`${SITE}${PATHNAME} — recording ${SECONDS}s of network activity\n`);

// domcontentloaded, not networkidle: the whole point is that this page never
// reaches networkidle, so waiting for it would time out before recording.
await page.goto(`${SITE}${PATHNAME}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(SECONDS * 1000);

const rows = [...calls.entries()].sort((a, b) => b[1].count - a[1].count);

console.log("REPEATED — made more than twice, which is what keeps a page awake:");
let repeated = 0;
for (const [url, row] of rows) {
  if (row.count <= 2) continue;
  repeated += 1;
  const statuses = [...row.statuses.entries()].map(([s, n]) => `${s}×${n}`).join(" ");
  console.log(`  ${String(row.count).padStart(4)}×  ${url}   [${statuses}]`);
}
if (!repeated) console.log("  none — the page settles");

console.log("\nREFUSED OR FAILED — any status at 400 or above:");
let bad = 0;
for (const [url, row] of rows) {
  for (const [status, n] of row.statuses) {
    if (typeof status === "number" && status < 400) continue;
    bad += 1;
    console.log(`  ${String(n).padStart(4)}×  ${status}  ${url}`);
  }
}
if (!bad) console.log("  none");

console.log(`\nconsole errors: ${consoleErrors.length}`);
for (const e of consoleErrors.slice(0, 10)) console.log(`  ${e}`);

console.log(`\ntotal requests: ${[...calls.values()].reduce((n, r) => n + r.count, 0)} across ${calls.size} endpoints`);

await browser.close();
