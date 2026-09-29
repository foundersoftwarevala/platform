/**
 * The three Demo Manager tabs that used to draw invented numbers.
 *
 * Two questions per tab: are the invented figures gone, and is real data there.
 * The invented ones are easy to test for because they were distinctive -
 * "E-Commerce Pro" and "Banking Portal" are not products this catalogue sells,
 * and 24.5K / 4m 32s / 99.97% were typed into the source.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = "https://softwarevala.net";

/** Strings that only ever came from the hardcoded arrays. */
const INVENTED = ["E-Commerce Pro", "Banking Portal", "Food Delivery", "Restaurant POS", "24.5K", "4m 32s", "99.97%", "Travel Booking"];

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1600, height: 1200 } })).newPage();
const failed = [];
p.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(SITE, "").slice(0, 60)}`); });
p.on("pageerror", (e) => failed.push(`pageerror ${String(e).slice(0, 90)}`));

await p.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await p.waitForTimeout(4000);
await p.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await p.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await p.waitForTimeout(2000);

for (const tab of ["Uptime Monitor", "Click Analytics", "Demo Catalog"]) {
  failed.length = 0;
  await p.goto(`${SITE}/demo-manager`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await p.waitForTimeout(10_000);

  const control = p.getByText(new RegExp(`^\\s*${tab}`, "i")).first();
  if (await control.count()) {
    await control.click({ timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(9000);
  }

  const seen = await p.evaluate((invented) => {
    const text = document.body.innerText || "";
    return {
      heading: (document.querySelector("h1")?.textContent ?? "").trim().slice(0, 40),
      invented: invented.filter((s) => text.includes(s)),
      // Any figure at all on the screen, so "real data present" can be told
      // apart from "the screen is blank".
      figures: (text.match(/\b\d[\d,.]*\s?(ms|%|s\b)?/g) ?? []).slice(0, 6),
      says_not_tracked: /not tracked|—/.test(text),
      problem: (text.match(/(could not|failed to|unauthori[sz]ed|no permission)[^\n]{0,50}/i) ?? [])[0] ?? null,
    };
  }, INVENTED);

  console.log(
    `  ${tab.padEnd(10)} [${seen.heading}] invented=${seen.invented.length ? JSON.stringify(seen.invented) : "none"} ` +
      `figures=${JSON.stringify(seen.figures)}${seen.problem ? ` «${seen.problem}»` : ""}${failed.length ? ` failed=${failed[0]}` : ""}`,
  );
}
await b.close();
