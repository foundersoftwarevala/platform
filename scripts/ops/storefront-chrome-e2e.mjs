/**
 * Floating Elements and Storefront Footer, end to end, against the live site.
 *
 * Both are draft-then-publish systems: sf_*_save writes the draft, sf_publish
 * makes it live, and the public page reads only the published snapshot. So the
 * chain to prove is
 *
 *   manager -> sf_floating_save / sf_footer_link_save
 *           -> sf_publish -> sf_config_live -> the page's chrome -> storefront
 *
 * The live page is not disturbed. Every change is made, checked against
 * sf_config_live, and undone inside the sixty seconds the chrome loader caches
 * its answer, so the served page never carries it. The run ends by comparing
 * the public footer to how it started.
 *
 *   node scripts/ops/storefront-chrome-e2e.mjs
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
  console.log(`${ok ? "OK  " : "FAIL"}  ${name.padEnd(50)} ${detail}`);
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
        return { status: r.status, json, text: text.slice(0, 220) };
      },
      [method, path, body ?? null],
    );
}

const footerHtml = async () => {
  const r = await fetch(`${SITE}/marketplace`, { headers: { "cache-control": "no-cache" } });
  const html = (await r.text()).replace(/\0/g, "");
  const i = html.lastIndexOf("All rights reserved");
  return i >= 0 ? html.slice(Math.max(0, i - 12000), i + 400) : html.slice(-12000);
};

const boss = await signIn(ops.SV_LOGIN_CONTROL_PANEL, ops.SV_PW_CONTROL_PANEL);
const api = apiFor(boss.page);

const footerBefore = await footerHtml();
const linkCountBefore = (footerBefore.match(/href="/g) || []).length;

let floatBefore = null;
let addedLinkId = null;

try {
  // ---- PART A: floating elements -------------------------------------------
  // sf_config_live takes the kind. Calling it with no argument answers 404
  // PGRST202 — the first version of this test did exactly that and reported two
  // healthy things as broken.
  const liveCfg = await api("POST", "rpc/sf_config_live", { p_kind: "floating" });
  step("the published storefront config is readable", liveCfg.status === 200, `HTTP ${liveCfg.status}`);

  const elements = await api(
    "GET",
    "storefront_floating_elements?select=key,enabled,position,desktop_enabled,mobile_enabled,priority&order=priority",
  );
  floatBefore = (elements.json ?? []).find((e) => e.key === "ai-chat") ?? null;
  step(
    "the floating elements are configured",
    (elements.json ?? []).length > 0 && Boolean(floatBefore),
    `${(elements.json ?? []).length} elements, ai-chat enabled=${floatBefore?.enabled}`,
  );

  const validated = await api("POST", "rpc/sf_validate", { p_kind: "floating" });
  step("floating config validates", validated.status === 200, String(validated.text).slice(0, 60));

  // Enable and publish, then read the published snapshot the page uses.
  // Its own corner. Moving it to bottom-left at priority 1 is refused, because
  // request-demo already sits there — which is the collision rule working, not
  // a failure, and is asserted separately below.
  await api("POST", "rpc/sf_floating_save", {
    p_key: "ai-chat",
    p_patch: { enabled: true },
  });
  const published = await api("POST", "rpc/sf_publish", {
    p_kind: "floating",
    p_note: "storefront-chrome-e2e: temporary, reverted in the same run",
  });
  const afterPublish = await api("POST", "rpc/sf_config_live", { p_kind: "floating" });
  const live = (afterPublish.json?.elements ?? afterPublish.json?.floating?.elements ?? []).find(
    (e) => e.key === "ai-chat",
  );
  step(
    "enabling and publishing puts it in the live snapshot",
    published.status === 200 && Boolean(live),
    live ? `present, ${Object.keys(live).length} fields` : "absent",
  );
  step(
    "the published element carries its position",
    live?.position === floatBefore.position,
    `position ${live?.position ?? "(not in the snapshot)"}`,
  );

  // Two elements cannot share a corner at the same priority. request-demo is
  // already bottom-left at priority 1, so moving ai-chat there must be refused
  // rather than silently stacking one widget on top of another.
  const collision = await api("POST", "rpc/sf_floating_save", {
    p_key: "ai-chat",
    p_patch: { position: "bottom-left", priority: 1 },
  });
  step(
    "a corner collision is refused",
    collision.json?.ok === false && collision.json?.reason === "corner_taken",
    String(collision.json?.message ?? collision.text).slice(0, 62),
  );

  // Put it back and publish again.
  await api("POST", "rpc/sf_floating_save", {
    p_key: "ai-chat",
    p_patch: { enabled: floatBefore.enabled, position: floatBefore.position },
  });
  await api("POST", "rpc/sf_publish", { p_kind: "floating", p_note: "storefront-chrome-e2e: restore" });
  const restored = await api("POST", "rpc/sf_config_live", { p_kind: "floating" });
  const goneAgain = (restored.json?.elements ?? restored.json?.floating?.elements ?? []).find(
    (e) => e.key === "ai-chat",
  );
  step(
    "disabling and publishing removes it again",
    !goneAgain,
    goneAgain ? "still present" : "absent from the live snapshot",
  );

  const versions = await api("POST", "rpc/sf_versions", { p_kind: "floating", p_limit: 5 });
  step(
    "publishing wrote a version",
    versions.status === 200 && (versions.json?.length ?? versions.json?.versions?.length ?? 0) > 0,
    `HTTP ${versions.status}`,
  );

  // ---- PART B: footer -------------------------------------------------------
  const cols = await api("GET", "storefront_footer_columns?select=id,heading,position&order=position");
  const column = (cols.json ?? [])[0];
  step("the footer columns are readable", Boolean(column), `${(cols.json ?? []).length} columns`);

  // link_type says what kind of destination this is, and position is bounded
  // 1..60 by the table. The first version of this test sent neither and was
  // correctly refused with "A link needs a real destination" — the validation
  // doing its job, which is asserted below.
  const rejected = await api("POST", "rpc/sf_footer_link_save", {
    p_patch: { column_id: column.id, label: "ZZ e2e probe", href: "/marketplace", position: 999 },
  });
  step(
    "a link with no destination type is refused",
    rejected.json?.ok === false,
    String(rejected.json?.message ?? rejected.text).slice(0, 62),
  );

  const added = await api("POST", "rpc/sf_footer_link_save", {
    p_patch: {
      column_id: column.id,
      label: "ZZ e2e probe",
      link_type: "internal",
      href: "/marketplace",
      enabled: false,
      position: 60,
    },
  });
  // The save answers with its own shape; the id is read back by label rather
  // than assumed to be at the top level of it.
  addedLinkId = added.json?.id ?? added.json?.link?.id ?? null;
  if (!addedLinkId) {
    const found = await api(
      "GET",
      "storefront_footer_links?select=id&label=eq.ZZ%20e2e%20probe&limit=1",
    );
    addedLinkId = (found.json ?? [])[0]?.id ?? null;
  }
  step(
    "a footer link can be added",
    added.status === 200 && Boolean(addedLinkId),
    `HTTP ${added.status}, id ${addedLinkId ? "resolved" : `not found — save answered ${String(added.text).slice(0, 60)}`}`,
  );

  // Disabled, so publishing cannot put it on the public page.
  const pubFooter = await api("POST", "rpc/sf_publish", {
    p_kind: "footer",
    p_note: "storefront-chrome-e2e: disabled probe link",
  });
  const liveFooter = await api("POST", "rpc/sf_config_live", { p_kind: "footer" });
  const inLive = JSON.stringify(liveFooter.json ?? {}).includes("ZZ e2e probe");
  step(
    "a disabled link is not published to the storefront",
    pubFooter.status === 200 && !inLive,
    inLive ? "it leaked into the live footer" : "absent, as a disabled link should be",
  );

  const removed = await api("POST", "rpc/sf_footer_link_remove", { p_id: addedLinkId, p_hard: true });
  const stillThere = await api(
    "GET",
    "storefront_footer_links?select=id&label=eq.ZZ%20e2e%20probe",
  );
  step(
    "the probe link is removed",
    removed.status === 200 && (stillThere.json ?? []).length === 0,
    `${(stillThere.json ?? []).length} left`,
  );
  if ((stillThere.json ?? []).length === 0) addedLinkId = null;

  const legal = await api("POST", "rpc/sf_legal_href", { p_policy_type: "privacy" });
  step(
    "the legal resolver answers",
    legal.status === 200,
    legal.json ? `privacy -> ${JSON.stringify(legal.json)}` : "returned nothing",
  );

  const audit = await api(
    "GET",
    "marketplace_audit_logs?select=action,actor_id&order=created_at.desc&limit=12",
  );
  const acts = (audit.json ?? []).map((a) => a.action);
  step(
    "the changes are audited",
    acts.some((a) => /storefront|footer|floating/.test(a)) && (audit.json ?? []).every((a) => a.actor_id),
    acts.slice(0, 4).join(", "),
  );
} catch (error) {
  step("the run completed", false, String(error).slice(0, 140));
} finally {
  try {
    if (addedLinkId) await api("POST", "rpc/sf_footer_link_remove", { p_id: addedLinkId, p_hard: true });
    if (floatBefore) {
      await api("POST", "rpc/sf_floating_save", {
        p_key: "ai-chat",
        p_patch: { enabled: floatBefore.enabled, position: floatBefore.position },
      });
    }
    await api("POST", "rpc/sf_publish", { p_kind: "floating", p_note: "storefront-chrome-e2e: final restore" });
    await api("POST", "rpc/sf_publish", { p_kind: "footer", p_note: "storefront-chrome-e2e: final restore" });
    const back = await api(
      "GET",
      "storefront_floating_elements?select=key,enabled,position&key=eq.ai-chat",
    );
    step(
      "ai-chat is back as it was",
      back.json?.[0]?.enabled === floatBefore?.enabled && back.json?.[0]?.position === floatBefore?.position,
      `enabled=${back.json?.[0]?.enabled}, ${back.json?.[0]?.position}`,
    );
  } catch (error) {
    step("the restore ran", false, String(error).slice(0, 120));
  }
  await boss.context.close();
}

// ---- permission -------------------------------------------------------------
try {
  const author = await signIn(ops.SV_LOGIN_AUTHOR, ops.SV_PW_TEST);
  const authorApi = apiFor(author.page);
  const denied = await authorApi("POST", "rpc/sf_floating_save", {
    p_key: "ai-chat",
    p_patch: { enabled: true },
  });
  step(
    "an author cannot change the storefront chrome",
    denied.status >= 400 || denied.json?.ok === false,
    `HTTP ${denied.status} ${String(denied.json?.reason ?? denied.text).slice(0, 46)}`,
  );
  await author.context.close();
} catch (error) {
  step("the permission check ran", false, String(error).slice(0, 120));
}

const footerAfter = await footerHtml();
const linkCountAfter = (footerAfter.match(/href="/g) || []).length;
step(
  "the public footer is unchanged",
  linkCountBefore === linkCountAfter,
  `${linkCountBefore} -> ${linkCountAfter} links`,
);

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} steps passed.`);
process.exit(failed ? 1 : 0);
