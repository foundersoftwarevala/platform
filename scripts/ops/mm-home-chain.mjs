/**
 * Does the homepage show what Marketplace Manager says it should?
 *
 * The chain is control -> database -> server render -> browser. Reading the
 * code proves the first link and nothing after it: a screen that saves a row
 * while the page ignores it looks exactly like one that works.
 *
 * The obvious test is to toggle a section and watch the page change. That is
 * not run here, because it would take a section off the live storefront for as
 * long as the layout cache holds it, and people are on the site. So this reads
 * instead of writing: it asks the database which sections are on and which are
 * off right now, then reads the public HTML and checks that each one is where
 * the database says it should be. A section marked off that still appears, or
 * one marked on that does not, is the chain being broken — and that is the same
 * fault a toggle would have found, without changing anything.
 *
 * It writes nothing at all.
 *
 *   node scripts/ops/mm-home-chain.mjs
 *
 * The database side needs the gateway, so on the server:
 *   SV_REST=http://127.0.0.1:3010 SV_SERVICE_KEY=... node scripts/ops/mm-home-chain.mjs
 */
import { readFileSync } from "node:fs";

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return out;
}

const ops = (() => {
  try {
    return readEnv(".env.ops");
  } catch {
    return {};
  }
})();
const SITE = (process.env.SV_SITE ?? ops.SV_SITE ?? "https://softwarevala.net").replace(/\/$/, "");
const REST = process.env.SV_REST;
const KEY = process.env.SV_SERVICE_KEY ?? "";

if (!REST) {
  console.log("SV_REST is not set — run this on the server, where the gateway is reachable.");
  process.exit(2);
}

/**
 * A marker that says whether a section rendered. Only sections with text of
 * their own are listed: a section whose heading is shared with another cannot
 * be told apart in the HTML, and guessing would produce a confident wrong
 * answer.
 */
const MARKERS = {
  "success-stories": /Success Stories/i,
  "awards-champions": /Awardss*(?:&amp;|&)s*Champions/i,
  "partner-ecosystem": /Partner Ecosystem/i,
  "vala-tv": /Vala TV/i,
  "vala-academy": /Vala Academy/i,
  "ai-zone": /AI Zone/i,
  "live-activity": /Live (?:Marketplace )?Activity/i,
  "enterprise-cta": /Enterprise/i,
  "shop-by-industry": /Shop by Industry/i,
  faq: /Frequently Asked|FAQ/i,
  footer: /All rights reserved/i,
};

/**
 * Sections that draw nothing when they have nothing to draw.
 *
 * SuccessStories and AwardsRow both return null on an empty list, by design —
 * an empty rail is worse than no rail. So "enabled but absent" is the right
 * answer for them when there is no published content, and calling it a broken
 * chain would be wrong. The endpoint they read is asked directly, so the
 * difference between "no content" and "not reaching the page" is measured
 * rather than assumed.
 */
const EMPTY_WHEN = {
  "success-stories": async (site) => {
    const r = await fetch(`${site}/api/marketplace/proof`);
    const d = await r.json().catch(() => ({}));
    return !Array.isArray(d.stories) || d.stories.length === 0;
  },
  "awards-champions": async (site) => {
    const r = await fetch(`${site}/api/marketplace/proof`);
    const d = await r.json().catch(() => ({}));
    return !Array.isArray(d.awards) || d.awards.length === 0;
  },
};

async function rest(path) {
  const res = await fetch(`${REST}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${text.slice(0, 140)}`);
  return text.trim() ? JSON.parse(text) : [];
}

const rows = await rest(
  "marketplace_homepage_sections?select=key,title,enabled,status,sort_order&order=sort_order",
);

const res = await fetch(`${SITE}/marketplace`, { headers: { "cache-control": "no-cache" } });
const html = (await res.text()).replace(/\0/g, "");

console.log(`${SITE}/marketplace — ${rows.length} registered sections, HTML ${html.length} bytes\n`);

let checked = 0;
let wrong = 0;
const unmarked = [];

for (const row of rows) {
  const marker = MARKERS[row.key];
  if (!marker) {
    unmarked.push(row.key);
    continue;
  }
  checked += 1;

  // The database's own rule for "on": enabled, and published rather than a
  // draft or an archived row.
  const shouldShow = row.enabled === true && String(row.status).toLowerCase() === "published";
  const isShown = marker.test(html);
  let agrees = shouldShow === isShown;
  let note = "";
  if (!agrees && shouldShow && !isShown && EMPTY_WHEN[row.key]) {
    const empty = await EMPTY_WHEN[row.key](SITE).catch(() => false);
    if (empty) {
      agrees = true;
      note = "  (on, but has no published content to draw)";
    }
  }
  if (!agrees) wrong += 1;

  console.log(
    `${agrees ? "OK  " : "FAIL"}  ${row.key.padEnd(20)} ` +
      `database says ${shouldShow ? "on " : "off"} (enabled=${row.enabled}, ${row.status})  ` +
      `page ${isShown ? "shows it" : "does not"}${note}`,
  );
}

console.log(`\n${checked - wrong}/${checked} sections match the database.`);
if (unmarked.length) {
  console.log(
    `${unmarked.length} not checked, having no text of their own to find in the HTML: ${unmarked.join(", ")}`,
  );
}
process.exit(wrong ? 1 : 0);
