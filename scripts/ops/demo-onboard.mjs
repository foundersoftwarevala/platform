/**
 * Puts a demo address through the whole Demo Manager pipeline and says what
 * happened at each step.
 *
 *   node scripts/ops/demo-onboard.mjs "<url>" "<product search term>"
 *   node scripts/ops/demo-onboard.mjs --batch          # the built-in list below
 *
 * The chain, which is the application's own and not reimplemented here:
 *
 *   investigate  fetch the address, collect the evidence, ask AI API Manager
 *                what the software is and which marketplace category it belongs
 *                to, and which branding and links are the developer's
 *   activate     fetch again, apply the Software Vala presentation, and refuse
 *                to go live unless the page comes back clean
 *
 * What it reports is read back from the demo row afterwards, not taken from the
 * response - the point of this is to know, not to be told.
 *
 * It spends AI credit and fetches somebody's site, so it does one URL at a time
 * and prints what it did.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const line of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = (ops.SV_SITE ?? "https://softwarevala.net").replace(/\/$/, "");

/** The addresses already taken in once, recovered from demo_url_audit_log. */
const BATCH = [
  { url: "https://diamond-law-nexus.lovable.app", find: "auditlegal" },
  { url: "https://drive-bright-school.lovable.app", find: "admissionschool" },
  { url: "https://bs-edutech-suite.lovable.app", find: "admissionschool" },
];

const jobs =
  process.argv[2] === "--batch"
    ? BATCH
    : process.argv[2]
      ? [{ url: process.argv[2], find: process.argv[3] ?? "school" }]
      : null;

if (!jobs) {
  console.error('Usage: node scripts/ops/demo-onboard.mjs "<url>" "<product search>"   |   --batch');
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);
await page.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await page.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await page.waitForTimeout(2500);

const call = (method, path, body) =>
  page.evaluate(
    async ([method, path, body]) => {
      let token = null;
      for (const k of Object.keys(localStorage)) {
        if (!/auth-token|supabase/i.test(k)) continue;
        try {
          const v = JSON.parse(localStorage.getItem(k));
          token = v?.access_token ?? v?.currentSession?.access_token ?? token;
        } catch {}
      }
      const r = await fetch(path, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch {}
      return { status: r.status, json, text: text.slice(0, 400) };
    },
    [method, path, body ?? null],
  );

const done = [];

for (const job of jobs) {
  console.log(`\n────────  ${job.url}`);

  const found = await call("GET", `/api/demo/process?products=${encodeURIComponent(job.find)}`);
  const product = (found.json?.products ?? [])[0];
  if (!product?.id) {
    console.log(`  FAIL  no product matched "${job.find}" to attach this demo to`);
    done.push({ url: job.url, ok: false, why: "no product" });
    continue;
  }
  console.log(`  product      : ${product.name} (${product.slug})`);

  const investigated = await call("POST", "/api/demo/process", {
    action: "investigate",
    productId: product.id,
    url: job.url,
  });
  if (investigated.status !== 200) {
    console.log(`  FAIL  investigate → HTTP ${investigated.status} ${investigated.text}`);
    done.push({ url: job.url, ok: false, why: `investigate ${investigated.status}` });
    continue;
  }

  const row = investigated.json?.demo ?? investigated.json?.row ?? investigated.json;
  const p = row?.processing ?? {};
  console.log(`  fetched      : http ${p.source?.http_status} → ${String(p.source?.final_url ?? "").slice(0, 60)}`);
  console.log(`  ai           : ${p.ai?.service ?? "none"}${p.ai?.model ? ` / ${p.ai.model}` : ""}`);
  console.log(
    `  identified   : ${p.identity?.software_name ?? "?"} → ${p.identity?.category_name ?? "?"} (confidence ${p.identity?.confidence ?? "?"})`,
  );
  console.log(
    `  developer    : ${(p.findings?.developer_links ?? []).length} link(s), ${(p.findings?.logos ?? []).length} logo(s), ${(p.evidence?.emails ?? 0)} email(s), ${(p.evidence?.phones ?? 0)} phone(s)`,
  );
  for (const l of (p.findings?.developer_links ?? []).slice(0, 2)) {
    console.log(`     to remove : ${String(l.value ?? l).slice(0, 78)}`);
  }

  const id = row?.id;
  if (!id) {
    console.log("  FAIL  investigate returned no demo row");
    done.push({ url: job.url, ok: false, why: "no row" });
    continue;
  }

  const activated = await call("POST", "/api/demo/process", { action: "activate", id });
  const after = activated.json?.demo ?? activated.json?.row ?? activated.json;
  const live = activated.status === 200 && (after?.status === "active" || after?.processing_status === "live");
  console.log(
    `  activate     : ${live ? "LIVE" : "not live"} — status ${after?.status ?? "?"} / ${after?.processing_status ?? "?"}` +
      (activated.status === 200 ? "" : `  HTTP ${activated.status} ${activated.text.slice(0, 160)}`),
  );

  done.push({ url: job.url, ok: live, product: product.slug, id });
}

console.log("\n────────  summary");
for (const d of done) {
  console.log(`  ${d.ok ? "LIVE " : "NOT  "} ${d.url}${d.product ? `  → /demo/${d.product}` : ""}${d.why ? `  (${d.why})` : ""}`);
}

await browser.close();
process.exit(done.every((d) => d.ok) ? 0 : 1);
