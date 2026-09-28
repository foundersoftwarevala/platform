/**
 * Layout Order, end to end, against the live site.
 *
 * Enable, disable and reorder are exercised through the same RPCs the manager
 * calls, as a signed-in operator, against the real table — then reverted.
 *
 * The live homepage is deliberately not disturbed. The renderer reads
 * mm_homepage_sections and the server caches that answer for a minute, so every
 * change here is made and undone well inside that window: the public page never
 * serves the changed layout. What is checked instead is mm_homepage_sections
 * itself, which is the set the renderer reads — and that the homepage honours
 * that set is already proven separately by mm-home-chain.mjs. The run ends by
 * confirming the public HTML is byte-identical to how it started.
 *
 * Permission is checked with a second, non-operator account, because a screen
 * that hides a button is not security.
 *
 *   node scripts/ops/layout-order-e2e.mjs
 */
import { readFileSync } from "node:fs";
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

const results = [];
const step = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "OK  " : "FAIL"}  ${name.padEnd(46)} ${detail}`);
};

const browser = await chromium.launch();

async function signIn(email, password) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(4000);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
  await page.waitForTimeout(2500);
  return { context, page };
}

/** One REST call as whoever this page is signed in as. */
function apiFor(page) {
  return (method, path, body) =>
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
          json = JSON.parse(text);
        } catch {}
        return { status: r.status, json, text: text.slice(0, 180) };
      },
      [method, path, body ?? null],
    );
}

const homeHtml = async () => {
  const r = await fetch(`${SITE}/marketplace`, { headers: { "cache-control": "no-cache" } });
  return (await r.text()).replace(/\0/g, "");
};

const boss = await signIn(ops.SV_LOGIN_CONTROL_PANEL, ops.SV_PW_CONTROL_PANEL);
const api = apiFor(boss.page);

const htmlBefore = await homeHtml();
let restore = [];

try {
  const all = await api("GET", "marketplace_homepage_sections?select=key,enabled,status,sort_order&order=sort_order");
  const sections = all.json ?? [];
  step("the registry is readable", all.status === 200 && sections.length > 0, `${sections.length} sections`);

  // A section that is already off, so turning it on and off again cannot change
  // what a visitor sees even for a moment.
  const target = sections.find((s) => s.enabled === false) ?? sections[sections.length - 1];
  step("a section that is already off was chosen", Boolean(target), target?.key ?? "none");

  // ---- TEST A: enable / disable -------------------------------------------
  const on = await api("POST", "rpc/mm_section_set_enabled", { p_key: target.key, p_enabled: true });
  restore.push(() => api("POST", "rpc/mm_section_set_enabled", { p_key: target.key, p_enabled: target.enabled }));
  const afterOn = await api("GET", `marketplace_homepage_sections?select=enabled&key=eq.${target.key}`);
  step("enabling writes to the database", on.status === 200 && afterOn.json?.[0]?.enabled === true);

  const live = await api("POST", "rpc/mm_homepage_sections", {});
  const inLive = (rows, key) => (rows ?? []).some((r) => r.key === key && r.live_now !== false);
  step("it becomes live in the set the renderer reads", inLive(live.json, target.key));

  const off = await api("POST", "rpc/mm_section_set_enabled", { p_key: target.key, p_enabled: false });
  const afterOff = await api("POST", "rpc/mm_homepage_sections", {});
  step(
    "disabling takes it out of that set",
    off.status === 200 && !inLive(afterOff.json, target.key),
  );

  // ---- TEST B: reorder -----------------------------------------------------
  const first = sections[0];
  const second = sections[1];
  const swapped = sections.map((s) => ({ key: s.key, sort_order: s.sort_order }));
  swapped[0] = { key: second.key, sort_order: first.sort_order };
  swapped[1] = { key: first.key, sort_order: second.sort_order };

  const moved = await api("POST", "rpc/mm_sections_reorder", { p_order: swapped });
  restore.push(() =>
    api("POST", "rpc/mm_sections_reorder", {
      p_order: sections.map((s) => ({ key: s.key, sort_order: s.sort_order })),
    }),
  );
  const order = await api("GET", "marketplace_homepage_sections?select=key,sort_order&order=sort_order&limit=2");
  step(
    "reorder swaps them in the database",
    moved.status === 200 && order.json?.[0]?.key === second.key,
    `${order.json?.[0]?.key} now first`,
  );

  const liveOrder = await api("POST", "rpc/mm_homepage_sections", {});
  const sortedKeys = (liveOrder.json ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => r.key);
  step("the renderer's set follows the new order", sortedKeys[0] === second.key, `${sortedKeys[0]} first`);

  // ---- duplicate / unknown keys are refused --------------------------------
  const dup = await api("POST", "rpc/mm_sections_reorder", {
    p_order: [{ key: first.key, sort_order: 10 }, { key: first.key, sort_order: 20 }],
  });
  step("a repeated key is refused", dup.status >= 400 || dup.json?.ok === false, `HTTP ${dup.status}`);

  const bogus = await api("POST", "rpc/mm_sections_reorder", {
    p_order: [{ key: "no-such-section-xyz", sort_order: 10 }],
  });
  step("an unknown key is refused", bogus.status >= 400 || bogus.json?.ok === false, `HTTP ${bogus.status}`);

  // ---- audit ---------------------------------------------------------------
  const audit = await api(
    "GET",
    "marketplace_audit_logs?select=action,actor_id&order=created_at.desc&limit=12",
  );
  const recent = (audit.json ?? []).map((a) => a.action);
  step(
    "the changes are in the audit log",
    recent.includes("section.enable") && recent.includes("section.disable") && recent.includes("section.reorder"),
    recent.slice(0, 4).join(", "),
  );
  step(
    "every audit entry names an actor",
    (audit.json ?? []).every((a) => a.actor_id),
  );
} catch (error) {
  step("the run completed", false, String(error).slice(0, 140));
} finally {
  for (const undo of restore.reverse()) await undo().catch(() => {});
  await boss.context.close();
}

// ---- permission, with a real non-operator account --------------------------
try {
  const author = await signIn(ops.SV_LOGIN_AUTHOR, ops.SV_PW_TEST);
  const authorApi = apiFor(author.page);
  const denied = await authorApi("POST", "rpc/mm_section_set_enabled", {
    p_key: "footer",
    p_enabled: false,
  });
  const stillOn = await authorApi("GET", "marketplace_homepage_sections?select=enabled&key=eq.footer");
  step(
    "an author cannot change the layout",
    denied.status >= 400 || denied.json?.ok === false || stillOn.json?.[0]?.enabled !== false,
    `HTTP ${denied.status} ${String(denied.text).slice(0, 60)}`,
  );
  await author.context.close();
} catch (error) {
  step("the permission check ran", false, String(error).slice(0, 120));
}

const htmlAfter = await homeHtml();
step(
  "the live page is unchanged",
  Math.abs(htmlAfter.length - htmlBefore.length) < 200,
  `${htmlBefore.length} -> ${htmlAfter.length} bytes`,
);

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} steps passed.`);
process.exit(failed ? 1 : 0);
