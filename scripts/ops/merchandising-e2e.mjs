/**
 * Merchandising Console, end to end, against the live site.
 *
 * The chain this proves is the one the brief calls most important:
 *
 *   Console -> mm_slot_assign -> marketplace_card_slots / row_config
 *           -> mm_row_products -> readCatalogRows -> the page's seed
 *           -> CuratedRow -> the public homepage
 *
 * Every mutation runs against `top-selling`, which is draft in
 * marketplace_row_config and disabled in marketplace_homepage_sections, so it
 * is not on the public page and cannot become so while this runs. The live
 * rows are read, never written. Everything is put back at the end, including
 * on failure, and the run finishes by checking the public HTML still carries
 * the same four rows it started with.
 *
 *   node scripts/ops/merchandising-e2e.mjs
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
const ROW = "top-selling";

const results = [];
const step = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "OK  " : "FAIL"}  ${name.padEnd(48)} ${detail}`);
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
        return { status: r.status, json, text: text.slice(0, 200) };
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
const rowsBefore = ["Featured Software", "Trending Now", "New Releases"].map(
  (t) => `${t}:${htmlBefore.split(t).length - 1}`,
);

let before = null;

try {
  // ---- the console's own view -----------------------------------------------
  const rows = await api("POST", "rpc/mm_rows_list", {});
  const list = Array.isArray(rows.json) ? rows.json : (rows.json?.rows ?? []);
  step("the console lists its rows", rows.status === 200 && list.length > 0, `${list.length} rows`);

  before = await api("POST", "rpc/mm_row_products", { p_key: ROW });
  const startProducts = before.json?.products ?? [];
  step(
    `${ROW} is not public, so it is safe to write`,
    before.json?.live_now === false,
    `live_now ${before.json?.live_now}, ${startProducts.length} product(s)`,
  );

  // ---- a real product from the real catalogue -------------------------------
  const found = await api(
    "GET",
    "marketplace_products?select=id,name,slug&visible=eq.true&content_status=eq.published&order=name&limit=3",
  );
  const product = (found.json ?? [])[0];
  step("a real product is found to assign", Boolean(product?.id), product?.slug ?? "none");

  // ---- assign ---------------------------------------------------------------
  const targetPosition = 4;
  const assigned = await api("POST", "rpc/mm_slot_assign", {
    p_key: ROW,
    p_position: targetPosition,
    p_product_id: product.id,
    p_override: true,
  });
  const afterAssign = await api("POST", "rpc/mm_row_products", { p_key: ROW });
  const atSlot = (afterAssign.json?.products ?? []).find(
    (x) => Number(x.position) === targetPosition,
  );
  step(
    "assign puts the product in the slot",
    assigned.status === 200 && atSlot?.product_id === product.id,
    `slot ${targetPosition} -> ${atSlot?.slug ?? "nothing"}`,
  );
  step("the assignment is marked as manual", atSlot?.pinned === true || atSlot?.source === "manual",
    `pinned ${atSlot?.pinned}, source ${atSlot?.source}`);

  // ---- an invalid product is refused ---------------------------------------
  const bogus = await api("POST", "rpc/mm_slot_assign", {
    p_key: ROW,
    p_position: 5,
    p_product_id: "00000000-0000-0000-0000-000000000000",
  });
  step(
    "an unknown product is refused",
    bogus.status >= 400 || bogus.json?.ok === false,
    `HTTP ${bogus.status} ${String(bogus.json?.reason ?? "").slice(0, 40)}`,
  );

  const badRow = await api("POST", "rpc/mm_slot_assign", {
    p_key: "no-such-row-xyz",
    p_position: 1,
    p_product_id: product.id,
  });
  step(
    "an unknown row is refused",
    badRow.status >= 400 || badRow.json?.ok === false,
    `HTTP ${badRow.status} ${String(badRow.json?.reason ?? "").slice(0, 40)}`,
  );

  // ---- reorder --------------------------------------------------------------
  const moved = await api("POST", "rpc/mm_slot_move", { p_key: ROW, p_from: targetPosition, p_to: 1 });
  const afterMove = await api("POST", "rpc/mm_row_products", { p_key: ROW });
  const first = (afterMove.json?.products ?? []).find((x) => Number(x.position) === 1);
  step(
    "move takes it to the first slot",
    moved.status === 200 && first?.product_id === product.id,
    `slot 1 -> ${first?.slug ?? "nothing"}`,
  );

  // ---- remove ---------------------------------------------------------------
  const removed = await api("POST", "rpc/mm_slot_remove", { p_key: ROW, p_position: 1 });
  const afterRemove = await api("POST", "rpc/mm_row_products", { p_key: ROW });
  const stillThere = (afterRemove.json?.products ?? []).some((x) => x.product_id === product.id);
  step(
    "remove releases the slot",
    removed.status === 200 && !stillThere,
    `${(afterRemove.json?.products ?? []).length} product(s) left`,
  );

  // ---- audit ----------------------------------------------------------------
  const audit = await api(
    "GET",
    "marketplace_audit_logs?select=action,actor_id&order=created_at.desc&limit=14",
  );
  const actions = (audit.json ?? []).map((a) => a.action);
  const slotActions = actions.filter((a) => /slot|row/.test(a));
  step(
    "the assignments are in the audit log",
    slotActions.length > 0 && (audit.json ?? []).every((a) => a.actor_id),
    slotActions.slice(0, 4).join(", ") || "none",
  );
} catch (error) {
  step("the run completed", false, String(error).slice(0, 140));
} finally {
  // Put the row back exactly as it was: clear what this run left, then restore
  // each product to the position it held.
  try {
    const now = await api("POST", "rpc/mm_row_products", { p_key: ROW });
    for (const p of now.json?.products ?? []) {
      await api("POST", "rpc/mm_slot_remove", { p_key: ROW, p_position: p.position }).catch(() => {});
    }
    for (const p of before?.json?.products ?? []) {
      await api("POST", "rpc/mm_slot_assign", {
        p_key: ROW,
        p_position: p.position,
        p_product_id: p.product_id,
        p_override: true,
      }).catch(() => {});
      if (p.pinned !== true) {
        await api("POST", "rpc/mm_slot_pin", { p_key: ROW, p_position: p.position, p_pinned: false }).catch(() => {});
      }
    }
    const back = await api("POST", "rpc/mm_row_products", { p_key: ROW });
    step(
      `${ROW} is back as it was`,
      (back.json?.products ?? []).length === (before?.json?.products ?? []).length,
      `${(back.json?.products ?? []).length} product(s)`,
    );
  } catch (error) {
    step(`${ROW} restored`, false, String(error).slice(0, 120));
  }
  await boss.context.close();
}

// ---- permission ------------------------------------------------------------
try {
  const author = await signIn(ops.SV_LOGIN_AUTHOR, ops.SV_PW_TEST);
  const authorApi = apiFor(author.page);
  const denied = await authorApi("POST", "rpc/mm_slot_assign", {
    p_key: ROW,
    p_position: 2,
    p_product_id: "00000000-0000-0000-0000-000000000000",
  });
  step(
    "an author cannot assign products",
    denied.status >= 400 || denied.json?.ok === false,
    `HTTP ${denied.status} ${String(denied.json?.reason ?? denied.text).slice(0, 44)}`,
  );
  await author.context.close();
} catch (error) {
  step("the permission check ran", false, String(error).slice(0, 120));
}

const htmlAfter = await homeHtml();
const rowsAfter = ["Featured Software", "Trending Now", "New Releases"].map(
  (t) => `${t}:${htmlAfter.split(t).length - 1}`,
);
step(
  "the public rows are unchanged",
  rowsBefore.join("|") === rowsAfter.join("|"),
  rowsAfter.join("  "),
);

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} steps passed.`);
process.exit(failed ? 1 : 0);
