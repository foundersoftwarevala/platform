/**
 * Sign in as one of the dashboard accounts and report what the screen shows.
 *
 * Reads the account from .env.ops, signs in through the real sign-in page, then
 * visits each path given and reports the heading, how much arrived, how many
 * controls, and every console error. Passwords are never printed.
 *
 *   node scripts/ops/probe-dashboard.mjs <ROLE> [path ...]
 *
 * e.g. node scripts/ops/probe-dashboard.mjs RESELLER /reseller-manager
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}

const ops = readEnv(".env.ops");
const role = (process.argv[2] ?? "CONTROL_PANEL").toUpperCase();
const paths = process.argv.slice(3);
const site = (ops.SV_SITE ?? "https://softwarevala.net").replace(/\/$/, "");

const email = ops[`SV_LOGIN_${role}`];
const password = ops[`SV_PW_${role}`] ?? ops.SV_PW_TEST;
if (!email || !password) {
  console.error(`No account for ${role} in .env.ops`);
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(`${site}/login`, { waitUntil: "networkidle", timeout: 90_000 });
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill(password);
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(8000);

console.log(`account : ${role} (${email})`);
console.log(`after sign in: ${page.url().replace(site, "")}`);
console.log(`sign-in errors: ${errors.length}`);
for (const e of [...new Set(errors)].slice(0, 3)) console.log(`  ${e.slice(0, 140)}`);

for (const path of paths) {
  errors.length = 0;
  await page.goto(site + path, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(5000);
  const seen = await page.evaluate(() => {
    const text = document.body.innerText ?? "";
    return {
      here: location.pathname,
      chars: text.length,
      controls: document.querySelectorAll("button,a[href],input,select,textarea").length,
      headings: [...document.querySelectorAll("h1,h2,h3")]
        .map((h) => h.textContent.trim())
        .filter(Boolean)
        .slice(0, 12),
      restricted: /access restricted|unauthorized|not permitted/i.test(text),
      firstLines: text.split("\n").filter(Boolean).slice(0, 8),
    };
  });
  console.log(`\n${path}`);
  console.log(`  landed   : ${seen.here}`);
  console.log(`  text     : ${seen.chars} characters, ${seen.controls} controls`);
  console.log(`  gated    : ${seen.restricted}`);
  console.log(`  headings : ${JSON.stringify(seen.headings)}`);
  console.log(`  top      : ${JSON.stringify(seen.firstLines)}`);
  if (errors.length) {
    console.log(`  errors   : ${errors.length}`);
    for (const e of [...new Set(errors)].slice(0, 3)) console.log(`    ${e.slice(0, 140)}`);
  }
}

await browser.close();
