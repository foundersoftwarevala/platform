/**
 * Can an operator actually add a demo?
 *
 * The `demos` table is empty and the owner wants to start filling it, so the
 * question is not "does the screen render" but "does the whole path from the
 * screen to a row and back to the marketplace work". This walks it as an
 * operator does: sign in, open Demo Manager, read what it loaded, then exercise
 * the create and read functions the screen itself calls.
 *
 * It creates one clearly-marked demo and removes it again, so the table is left
 * exactly as it was found. Nothing else is touched.
 *
 *   node scripts/ops/demo-manager-e2e.mjs
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const line of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = (ops.SV_SITE ?? "https://softwarevala.net").replace(/\/$/, "");

const results = [];
const step = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "OK  " : "FAIL"}  ${name.padEnd(44)} ${detail}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 110)));
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 110));
});

await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);
await page.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await page.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await page.waitForTimeout(2500);
step("an operator can sign in", true, ops.SV_LOGIN_CONTROL_PANEL);

// ---- the screen itself --------------------------------------------------
await page.goto(`${SITE}/demo-manager`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(11_000);

const screen = await page.evaluate(() => {
  const text = document.body.innerText || "";
  return {
    restricted: /access restricted|checking workspace access/i.test(text),
    heading: (document.querySelector("h1, h2")?.textContent ?? "").trim().slice(0, 60),
    nodes: document.getElementsByTagName("*").length,
    buttons: document.querySelectorAll("button").length,
    // Whether the screen is telling the operator something went wrong.
    failure: (text.match(/(could not|failed to|unauthori[sz]ed|permission)[^\n]{0,80}/i) ?? [])[0] ?? null,
  };
});
step("Demo Manager opens for an operator", !screen.restricted, screen.heading);
step("it rendered a real screen", screen.nodes > 250, `${screen.nodes} nodes, ${screen.buttons} buttons`);
step("it reports no failure to the operator", !screen.failure, screen.failure ?? "nothing reported");

// ---- the data layer behind it ------------------------------------------
const api = (method, path, body) =>
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
      const r = await fetch(`/rest/v1/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {}
      return { status: r.status, json, text: text.slice(0, 220) };
    },
    [method, path, body ?? null],
  );

const read = await api("GET", "demos?select=id&limit=1");
step("an operator may read demos", read.status === 200, `HTTP ${read.status} ${read.status === 200 ? "" : read.text}`);

const product = await api(
  "GET",
  "marketplace_products?select=id,name,slug&visible=eq.true&content_status=eq.published&order=name&limit=1",
);
const target = (product.json ?? [])[0];
step("a real product is available to attach a demo to", Boolean(target?.id), target?.slug ?? "none");

// ---- create, read back, remove ----------------------------------------
let createdId = null;
if (target?.id) {
  const marker = `E2E CHECK - safe to delete ${new Date().toISOString()}`;
  // Only title and url are required: everything else on demos carries a
  // default. A demo is not tied to a product on this table - that link lives
  // in product_demo_mappings - and demo_status has no "draft", so an
  // inactive demo is the one that is not shown.
  const created = await api("POST", "demos", {
    title: marker,
    url: "https://softwarevala.net/",
    status: "inactive",
  });
  createdId = Array.isArray(created.json) ? created.json[0]?.id ?? null : null;
  step(
    "an operator can create a demo",
    created.status < 300 && Boolean(createdId),
    `HTTP ${created.status} ${createdId ? "" : created.text}`,
  );

  if (createdId) {
    const back = await api("GET", `demos?select=id,title,status,url&id=eq.${createdId}`);
    const row = (back.json ?? [])[0];
    step(
      "the demo reads back with what was sent",
      row?.title === marker,
      row ? `status ${row.status}` : "not found",
    );

    const removed = await api("DELETE", `demos?id=eq.${createdId}`);
    const gone = await api("GET", `demos?select=id&id=eq.${createdId}`);
    step(
      "the check removed its own row",
      removed.status < 300 && (gone.json ?? []).length === 0,
      `HTTP ${removed.status}`,
    );
  }
}

step("no console errors on the screen", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
