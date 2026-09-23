/**
 * Exactly what a real browser asks the site for, and what it gets back.
 *
 * curl and a browser were getting different answers for the same URL, which is
 * the sort of disagreement that makes a diagnosis worthless until it is
 * resolved. This records every request the browser makes under /assets/ with
 * its status, so the two can be compared on the same evidence.
 *
 *   node scripts/ops/probe-requests.mjs [url]
 */
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "https://softwarevala.net/";
const browser = await chromium.launch();
const page = await browser.newPage();

const seen = [];
page.on("response", async (r) => {
  if (!r.url().includes("/assets/")) return;
  seen.push({
    name: r.url().split("/").pop(),
    status: r.status(),
    fromCache: r.fromServiceWorker(),
    cf: r.headers()["cf-cache-status"] ?? "",
  });
});
page.on("requestfailed", (r) => {
  if (r.url().includes("/assets/")) {
    seen.push({ name: r.url().split("/").pop(), status: `FAILED ${r.failure()?.errorText}`, cf: "" });
  }
});

await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(4000);

const referenced = await page.evaluate(() =>
  Array.from(
    new Set(
      Array.from(document.querySelectorAll("script[src], link[href]"))
        .map((el) => el.getAttribute("src") ?? el.getAttribute("href") ?? "")
        .filter((u) => u.startsWith("/assets/"))
        .map((u) => u.split("/").pop()),
    ),
  ),
);

await browser.close();

const asked = new Map(seen.map((s) => [s.name, s]));
console.log(`referenced in the document : ${referenced.length}`);
console.log(`actually requested         : ${asked.size}`);
console.log();

const bad = seen.filter((s) => typeof s.status !== "number" || s.status >= 400);
console.log(`requests that did not answer 200: ${bad.length}`);
for (const b of bad) console.log(`   ${b.status}  ${b.name}  ${b.cf}`);
console.log();

const never = referenced.filter((r) => !asked.has(r));
console.log(`referenced but never requested by the browser: ${never.length}`);
for (const n of never) console.log(`   ${n}`);
console.log();

// The eight files the origin answers 500 for. What a browser gets for them,
// and from where, is the whole question: a cache hit means visitors are being
// served a copy Cloudflare kept, not anything the server can still produce.
const ORIGIN_500 = [
  "index-B6u7noUL.js", "routes-CcOcmHAQ.js", "client-Zw8zFNr2.js",
  "HomeIndex-f0EftQ_-.js", "home-route-data-Pezuw3Py.js",
  "use-translation-De8_Ymfk.js", "language-catalog-CKgnDFBp.js",
  "LanguageSelector-Q-BI02Tz.js",
];
console.log("the files the origin answers 500 for, as the browser got them:");
for (const name of ORIGIN_500) {
  const hit = asked.get(name);
  console.log(`   ${name.padEnd(30)} ${hit ? `${hit.status}  cf-cache-status=${hit.cf || "(none)"}` : "not requested"}`);
}
