/**
 * Every screen opened in a real browser, not just fetched.
 *
 * A 200 only says the shell rendered. This opens each screen, lets it settle,
 * and reports what a person would find: how much text arrived, how many
 * controls, whether an error boundary or a sign-in wall is showing, and every
 * console error the page raised. A screen that answers 200 and then throws is
 * the thing this is looking for.
 *
 *   node scripts/ops/sweep-screens.mjs [site] [concurrency]
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const site = (process.argv[2] ?? "https://softwarevala.net").replace(/\/$/, "");
const lanes = Number(process.argv[3] ?? 4);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const paths = new Set();
for (const file of walk("src/routes")) {
  let route = file.replace(/\\/g, "/").replace(/^src\/routes\//, "").replace(/\.tsx$/, "");
  if (route === "__root" || route.includes("/-") || route.startsWith("-")) continue;
  if (route.endsWith(".index")) route = route.slice(0, -".index".length);
  if (route === "index") route = "";
  route = route.replace(/\./g, "/").replace(/\/+$/, "");
  if (route.includes("$")) continue;
  paths.add("/" + route);
}
const list = [...paths].sort();

const browser = await chromium.launch();
const results = [];

async function visit(context, path) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  let record;
  try {
    await page.goto(site + path, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(3500);
    const seen = await page.evaluate(() => {
      const text = document.body.innerText ?? "";
      return {
        url: location.pathname,
        chars: text.length,
        controls: document.querySelectorAll("button,a[href],input,select,textarea").length,
        rows: document.querySelectorAll("tr,[role='row'],li").length,
        boundary: /something went wrong|unexpected error|application error|failed to load/i.test(text),
        signIn: /sign in|log in to continue|please sign in|unauthorized/i.test(text.slice(0, 1200)),
        heading: (document.querySelector("h1,h2")?.textContent ?? "").trim().slice(0, 48),
      };
    });
    record = {
      path,
      ...seen,
      errors: [...new Set(errors)],
      kind: seen.boundary
        ? "BROKEN"
        : seen.signIn
          ? "SIGN-IN"
          : errors.length
            ? "ERRORS"
            : seen.chars < 400
              ? "EMPTY"
              : "OK",
    };
  } catch (error) {
    record = { path, kind: "BROKEN", chars: 0, controls: 0, rows: 0, errors: [String(error).slice(0, 120)] };
  }
  await page.close();
  return record;
}

const queue = [...list];
await Promise.all(
  Array.from({ length: lanes }, async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    while (queue.length) {
      const path = queue.shift();
      const record = await visit(context, path);
      results.push(record);
      process.stdout.write(
        `${record.kind.padEnd(8)} ${String(record.chars).padStart(6)}ch ${String(record.controls).padStart(4)}ctl ${record.path}` +
          (record.errors.length ? `  !${record.errors[0].slice(0, 70)}` : "") +
          "\n",
      );
    }
    await context.close();
  }),
);
await browser.close();

results.sort((a, b) => a.path.localeCompare(b.path));
writeFileSync("screen-sweep.json", JSON.stringify(results, null, 2));

const by = (kind) => results.filter((r) => r.kind === kind);
console.log(`\n${results.length} screens opened at ${site}`);
for (const kind of ["OK", "ERRORS", "EMPTY", "SIGN-IN", "BROKEN"]) {
  console.log(`  ${kind.padEnd(8)} ${by(kind).length}`);
}
for (const kind of ["BROKEN", "ERRORS", "EMPTY"]) {
  const rows = by(kind);
  if (!rows.length) continue;
  console.log(`\n${kind}:`);
  for (const r of rows) console.log(`  ${r.path}${r.errors[0] ? `  — ${r.errors[0].slice(0, 110)}` : ""}`);
}
console.log(`\nfull detail written to screen-sweep.json`);
