/**
 * Every operator console, opened from the inside.
 *
 * Signs in as the control panel and walks each manager route, reporting what a
 * person would actually find: whether it rendered, how much arrived, how many
 * controls, whether an error boundary or a sign-in wall is showing, and every
 * console error the page raised.
 *
 *   node scripts/ops/sweep-managers.mjs [concurrency]
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
const site = (ops.SV_SITE ?? "https://softwarevala.net").replace(/\/$/, "");
const lanes = Number(process.argv[2] ?? 3);

const ROUTES = [
  "/control-panel", "/marketplace-manager", "/reseller-manager", "/franchise-manager",
  "/vendor-manager", "/affiliate-manager", "/influencer-manager", "/creator-manager",
  "/seo-manager", "/finance-manager", "/legal-manager", "/language-manager",
  "/lead-manager", "/task-manager", "/promise-tracker", "/assist-manager",
  "/ams-manager", "/demo-manager", "/product-demo-manager", "/demo-ops", "/demo-workspace",
  "/dev-manager", "/server-manager", "/chat-manager", "/sales-crm", "/sales-support-manager",
  "/support", "/support-agent", "/marketplace-recovery", "/pages", "/keywords",
  "/vala-ai", "/ai-ceo", "/marketing", "/vala-tv", "/chat",
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });

// One sign-in, shared by every tab.
const entry = await context.newPage();
await entry.goto(`${site}/login`, { waitUntil: "networkidle", timeout: 120_000 });
await entry.locator('input[type="email"]').fill(ops.SV_LOGIN_CONTROL_PANEL);
await entry.locator('input[type="password"]').fill(ops.SV_PW_CONTROL_PANEL);
await entry.locator('button[type="submit"]').click();
await entry.waitForTimeout(9000);
console.log(`signed in, landed on ${entry.url().replace(site, "") || "/"}\n`);
await entry.close();

const results = [];
const queue = [...ROUTES];

await Promise.all(
  Array.from({ length: lanes }, async () => {
    const page = await context.newPage();
    while (queue.length) {
      const path = queue.shift();
      const errors = [];
      const onError = (e) => errors.push(e.message);
      const onConsole = (m) => m.type() === "error" && errors.push(m.text());
      page.on("pageerror", onError);
      page.on("console", onConsole);
      let record;
      try {
        await page.goto(site + path, { waitUntil: "domcontentloaded", timeout: 90_000 });
        await page.waitForTimeout(6000);
        const seen = await page.evaluate(() => {
          const text = document.body.innerText ?? "";
          return {
            chars: text.length,
            controls: document.querySelectorAll("button,a[href],input,select,textarea").length,
            rows: document.querySelectorAll("tr,[role='row']").length,
            broken: /something went wrong|application error|this page didn.t load|failed to render/i.test(text),
            gated: /access restricted|not have the required/i.test(text),
            heading: (document.querySelector("h1,h2")?.textContent ?? "").trim().slice(0, 44),
          };
        });
        record = {
          path, ...seen,
          errors: [...new Set(errors)],
          state: seen.gated ? "GATED" : seen.broken ? "BROKEN" : errors.length ? "ERRORS" : seen.chars < 150 ? "EMPTY" : "OK",
        };
      } catch (error) {
        record = { path, state: "BROKEN", chars: 0, controls: 0, rows: 0, errors: [String(error).slice(0, 120)] };
      }
      page.off("pageerror", onError);
      page.off("console", onConsole);
      results.push(record);
      process.stdout.write(
        `${record.state.padEnd(7)} ${String(record.chars).padStart(6)}ch ${String(record.controls).padStart(4)}ctl ${String(record.rows).padStart(4)}row  ${record.path}` +
          (record.errors.length ? `  !${record.errors[0].slice(0, 60)}` : "") + "\n",
      );
    }
    await page.close();
  }),
);

await browser.close();
results.sort((a, b) => a.path.localeCompare(b.path));
writeFileSync("manager-sweep.json", JSON.stringify(results, null, 2));

const by = (s) => results.filter((r) => r.state === s);
console.log(`\n${results.length} consoles opened as the control panel`);
for (const s of ["OK", "ERRORS", "EMPTY", "GATED", "BROKEN"]) console.log(`  ${s.padEnd(7)} ${by(s).length}`);
for (const s of ["BROKEN", "GATED", "EMPTY", "ERRORS"]) {
  const rows = by(s);
  if (!rows.length) continue;
  console.log(`\n${s}:`);
  for (const r of rows) console.log(`  ${r.path}${r.errors[0] ? `  — ${r.errors[0].slice(0, 100)}` : ""}`);
}
