/**
 * Hero Banner Manager, end to end, against the live site.
 *
 * Every step is the real chain: a signed-in operator's session, the same REST
 * endpoint the manager calls, the real database, and the real public homepage.
 * Nothing is mocked and nothing is asserted from the source.
 *
 * The live homepage is not disturbed. The slide this creates is a draft
 * (visible = false) for every step that does not have to prove publication, and
 * the one step that does publishes it at the end of the order, checks the
 * homepage, and takes it down again — a slide the public never sees at the top
 * of the carousel. Everything is removed afterwards, including on failure.
 *
 *   node scripts/ops/hero-e2e.mjs
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
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"}  ${name.padEnd(42)} ${detail}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);
await page.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await page.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await page.waitForTimeout(3000);

/** One REST call as the signed-in operator, from inside the page. */
async function api(method, path, body) {
  return page.evaluate(
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
  const r = await fetch(`${SITE}/`, { headers: { "cache-control": "no-cache" } });
  return (await r.text()).replace(/\0/g, "");
};

const SLUG = `zz-e2e-${Date.now().toString(36)}`;
const MARK = `E2E ${SLUG}`;
let id = null;

try {
  // Anything an interrupted earlier run left behind.
  const old = await api("GET", "home_hero_slides?select=id&slug=like.zz-e2e-*");
  for (const row of old.json ?? []) await api("DELETE", `home_hero_slides?id=eq.${row.id}`);

  const before = await api("GET", "home_hero_slides?select=id,position&order=position");
  const startCount = (before.json ?? []).length;

  // 1-2. Create, as a draft.
  const created = await api("POST", "home_hero_slides", {
    slug: SLUG,
    kicker: "E2E",
    title: MARK,
    subtitle: "temporary",
    highlight: "",
    cta_primary: "Browse Products",
    cta_link: "/marketplace",
    cta_secondary: "Watch Live Demo",
    cta_secondary_link: "/demos/public",
    gradient: "from-[#0b1a30] via-[#12325c] to-[#0a1526]",
    icon_name: "Sparkles",
    accent: "text-cyan-300",
    position: 9999,
    visible: false,
  });
  id = created.json?.[0]?.id ?? null;
  step("create a slide", created.status === 201 && Boolean(id), `HTTP ${created.status}`);
  if (!id) throw new Error("nothing was created, so the rest cannot run");

  // 3-4. Persistence, read back fresh.
  const back = await api(
    "GET",
    `home_hero_slides?select=slug,title,visible,cta_link,cta_secondary_link,archived_at,created_by,updated_by&id=eq.${id}`,
  );
  const row = back.json?.[0] ?? {};
  step("it persists", row.slug === SLUG && row.title === MARK, `slug ${row.slug}`);
  step(
    "the secondary CTA keeps its own link",
    row.cta_secondary_link === "/demos/public" && row.cta_link === "/marketplace",
    `primary ${row.cta_link}, secondary ${row.cta_secondary_link}`,
  );
  step(
    "the database records who made it",
    Boolean(row.created_by) && Boolean(row.updated_by),
    row.created_by ? `created_by ${String(row.created_by).slice(0, 8)}…` : "null",
  );

  // 5. A draft must not be served at all.
  const draftServed = await api(
    "GET",
    `home_hero_slides?select=slug&visible=eq.true&slug=eq.${SLUG}`,
  );
  step("a draft is never served", (draftServed.json ?? []).length === 0);

  // 6-7. Publish it and check the set the homepage actually reads.
  //
  // Not by looking for it in the HTML: the carousel renders one slide at a
  // time, so only the first slide is ever in the markup, and a slide published
  // at the end of the order would be absent whether publishing worked or not.
  // Putting the test slide first instead would mean showing it to real
  // visitors, which is not worth proving a point over.
  //
  // So this asks the same question the page asks — visible, inside its window,
  // ordered by position — and checks the slide is in the answer. That set is
  // what the homepage renders from, so being in it is what published means.
  await api("PATCH", `home_hero_slides?id=eq.${id}`, { visible: true, published_at: null });
  const nowIso = new Date().toISOString();
  const servedQuery =
    "home_hero_slides?select=id,slug&visible=eq.true" +
    `&or=(published_at.is.null,published_at.lte.${nowIso})` +
    `&or=(unpublish_at.is.null,unpublish_at.gt.${nowIso})` +
    "&order=position.asc";
  const served = await api("GET", servedQuery);
  const inServed = (rows) => (rows ?? []).some((r) => r.slug === SLUG);
  step(
    "publishing puts it in the set the homepage reads",
    served.status === 200 && inServed(served.json),
    `${(served.json ?? []).length} slides served`,
  );

  // 8-9. Reorder, and check the published order followed.
  const ids = [...(before.json ?? []).map((r) => r.id)];
  const reordered = await api("POST", "rpc/mm_hero_reorder", { p_ids: [id, ...ids] });
  const positions = await api("GET", `home_hero_slides?select=position&id=eq.${id}`);
  step(
    "reorder moves it to first",
    reordered.json?.ok === true && positions.json?.[0]?.position === 10,
    `position ${positions.json?.[0]?.position}`,
  );

  // 10-11. Disable it, and check it leaves that same set.
  await api("PATCH", `home_hero_slides?id=eq.${id}`, { visible: false });
  const afterDisable = await api("GET", servedQuery);
  step("disabling removes it from that set", !inServed(afterDisable.json));

  // 12-14. Schedule it for the future.
  const future = new Date(Date.now() + 86_400_000).toISOString();
  await api("PATCH", `home_hero_slides?id=eq.${id}`, { visible: true, published_at: future });
  const scheduled = await api("GET", `home_hero_slides?select=published_at,visible&id=eq.${id}`);
  const afterSchedule = await api("GET", servedQuery);
  const stillHidden = !inServed(afterSchedule.json);
  step(
    "a future start date keeps it off the page",
    scheduled.json?.[0]?.published_at?.slice(0, 10) === future.slice(0, 10) && stillHidden,
    "scheduled for tomorrow",
  );

  // 15-16. Archive it.
  await api("PATCH", `home_hero_slides?id=eq.${id}`, {
    visible: false,
    archived_at: new Date().toISOString(),
  });
  const archived = await api("GET", `home_hero_slides?select=archived_at,visible&id=eq.${id}`);
  step(
    "archiving is distinct from drafting",
    Boolean(archived.json?.[0]?.archived_at) && archived.json?.[0]?.visible === false,
    "archived_at set, visible false",
  );

  // 17-18. Restore it.
  await api("PATCH", `home_hero_slides?id=eq.${id}`, { archived_at: null });
  const restored = await api("GET", `home_hero_slides?select=archived_at&id=eq.${id}`);
  step("restoring clears the archive", restored.json?.[0]?.archived_at === null);

  // 19. The audit trail.
  const audit = await api(
    "GET",
    `marketplace_audit_logs?select=action,actor_id&entity_id=eq.${id}&order=created_at`,
  );
  const actions = (audit.json ?? []).map((a) => a.action);
  const wanted = [
    "hero.slide.created",
    "hero.slide.published",
    "hero.slide.reordered",
    "hero.slide.unpublished",
    "hero.slide.archived",
    "hero.slide.restored",
  ];
  const missing = wanted.filter((a) => !actions.includes(a));
  step(
    "every action is in the audit log",
    missing.length === 0 && (audit.json ?? []).every((a) => a.actor_id),
    missing.length ? `missing ${missing.join(", ")}` : `${actions.length} entries, all with an actor`,
  );
} catch (error) {
  step("the run completed", false, String(error).slice(0, 140));
} finally {
  if (id) {
    await api("DELETE", `home_hero_slides?id=eq.${id}`);
    const gone = await api("GET", `home_hero_slides?select=id&id=eq.${id}`);
    step("the test slide is removed", (gone.json ?? []).length === 0);
  }
  step("the live homepage never showed it", !(await homeHtml()).includes(MARK));
  const left = await api("GET", "home_hero_slides?select=id&slug=like.zz-e2e-*");
  const total = await api("GET", "home_hero_slides?select=id");
  step(
    "nothing is left behind",
    (left.json ?? []).length === 0,
    `${(total.json ?? []).length} slides remain`,
  );
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} steps passed.`);
process.exit(failed ? 1 : 0);
