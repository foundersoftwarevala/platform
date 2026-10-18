/**
 * The influencer QR chain, end to end against the live site.
 *
 *   influencer signs in -> Referral Links -> searches the real catalogue
 *   -> picks a product -> a QR is created -> the image renders
 *   -> the QR's address is fetched the way a phone camera would
 *   -> the scan is recorded and the visitor lands on that product with ?ref=
 *   -> asking again returns the same QR, not a second one
 *
 * Checked against the database after each step, because a screen saying "ready"
 * proves nothing.
 *
 *   node scripts/ops/influencer-qr-e2e.mjs
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = "https://softwarevala.net";

function sql(query) {
  const out = execFileSync(
    process.execPath,
    ["scripts/ops/db.mjs", "--sql", `select coalesce((${query})::text, 'NULL') as answer`],
    { encoding: "utf8", timeout: 120_000 },
  );
  const lines = out.split("\n").map((l) => l.trim());
  const i = lines.findIndex((l) => l === "answer");
  return i >= 0 ? (lines[i + 2] ?? "") : out.trim();
}

const step = (name, ok, detail = "") =>
  console.log(`  ${(ok ? "REAL" : "BROKEN").padEnd(6)} ${name.padEnd(48)} ${detail}`);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
const page = await context.newPage();
const failed = [];
page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(SITE, "").slice(0, 70)}`); });
page.on("pageerror", (e) => failed.push(`pageerror ${String(e).slice(0, 100)}`));

await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);
await page.fill('input[type="email"]', ops.SV_LOGIN_INFLUENCER);
await page.fill('input[type="password"]', ops.SV_PW_TEST);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await page.waitForTimeout(2000);

await page.goto(`${SITE}/dashboard/influencer`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(9000);
await page.locator("button, a").filter({ hasText: /^\s*Referral Links\s*$/i }).first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(8000);

step("the promote panel is on the screen", (await page.locator("[data-product-promotion]").count()) > 0);

// Search the real catalogue.
failed.length = 0;
await page.locator("[data-product-promotion] input").first().fill("school");
await page.locator("[data-product-promotion] button[type=submit]").first().click({ timeout: 8000 });
await page.waitForTimeout(7000);
const results = await page.locator("[data-product-promotion] li").count();
step("the catalogue search returns real products", results > 0, `${results} result(s)`);

if (results > 0) {
  const before = Number(sql("select count(*) from product_qr_codes where influencer_profile_id is not null"));
  await page.locator("[data-product-promotion] li button").first().click({ timeout: 8000 });
  await page.waitForTimeout(9000);

  const code = (await page.locator("[data-product-qr]").first().getAttribute("data-product-qr").catch(() => null)) ?? "";
  const after = Number(sql("select count(*) from product_qr_codes where influencer_profile_id is not null"));
  step("a QR was created for that product", Boolean(code) && after > before, `code=${code || "none"} rows ${before} -> ${after}`);

  if (code) {
    // The image the operator downloads.
    const png = await page.evaluate(async (c) => {
      const r = await fetch(`/api/qr/${c}.png`);
      return { status: r.status, type: r.headers.get("content-type"), bytes: (await r.arrayBuffer()).byteLength };
    }, code);
    step("the QR image renders", png.status === 200 && png.bytes > 200, `${png.status} ${png.type} ${png.bytes} bytes`);

    // Scanned, the way a phone would: a plain GET, no session.
    const scansBefore = Number(sql(`select coalesce(scan_count,0) from product_qr_codes where qr_code='${code}'`));
    const fresh = await browser.newContext();
    const scanner = await fresh.newPage();
    await scanner.goto(`${SITE}/api/qr/scan/${code}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await scanner.waitForTimeout(7000);
    const landed = scanner.url();
    const scansAfter = Number(sql(`select coalesce(scan_count,0) from product_qr_codes where qr_code='${code}'`));
    const events = Number(sql(`select count(*) from product_qr_events e join product_qr_codes q on q.id=e.qr_id where q.qr_code='${code}'`));

    step("the scan lands on the product with a ref", /\/marketplace\/product\/.+[?&]ref=/.test(landed), landed.replace(SITE, "").slice(0, 70));
    step("the scan was counted", scansAfter === scansBefore + 1, `scan_count ${scansBefore} -> ${scansAfter}, events=${events}`);

    // And the visit is attributed the way a shared link is.
    const cookie = (await fresh.cookies()).find((c) => c.name === "sv_ref");
    const session = Number(sql(
      `select count(*) from marketplace_referral_sessions s join marketplace_referral_codes c on c.id=s.referral_code_id
        where c.code = (select rc.code from marketplace_referral_codes rc
                          join product_qr_codes q on q.referral_code_id = rc.id where q.qr_code='${code}')`,
    ));
    step("the scan is attributed to the influencer", Boolean(cookie) && session > 0, `cookie=${cookie ? "set" : "missing"} sessions=${session}`);
    await fresh.close();

    // Asking again must not mint a rival code.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);
    await page.locator("button, a").filter({ hasText: /^\s*Referral Links\s*$/i }).first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(7000);
    await page.locator("[data-product-promotion] input").first().fill("school");
    await page.locator("[data-product-promotion] button[type=submit]").first().click({ timeout: 8000 });
    await page.waitForTimeout(6000);
    await page.locator("[data-product-promotion] li button").first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(8000);
    const total = Number(sql("select count(*) from product_qr_codes where influencer_profile_id is not null"));
    step("asking twice returns the same QR", total === after, `still ${total} QR row(s)`);
  }
}

if (failed.length) console.log("  failed requests:", failed.slice(0, 3).join(" | "));
await browser.close();
