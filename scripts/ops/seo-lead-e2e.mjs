/**
 * The chain, walked for real: search arrival -> card slot -> CTA -> lead.
 *
 * Section 16 asks for an acceptance test that proves the connection with
 * actual database output rather than a mock. So this posts one genuine capture
 * to the live endpoint, exactly as a browser would, carrying the attribution a
 * visitor arriving from Google onto a card slot would have carried - and then
 * reads the row back out of the database and checks that every link in the
 * chain was recorded.
 *
 * It writes one lead. That lead is real and is left in place: deleting rows
 * from a live table to tidy up after a test is how real records get lost, and
 * the owner decides what happens to it. It is named so it is obvious what it
 * is, and the script prints its id.
 *
 *   node scripts/ops/seo-lead-e2e.mjs                       # against production
 *   node scripts/ops/seo-lead-e2e.mjs http://127.0.0.1:3000 # against the server
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const SITE = (process.argv[2] || "https://softwarevala.net").replace(/\/+$/, "");

function readEnv(file) {
  const out = {};
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const at = line.indexOf("=");
      if (at < 0 || line.trim().startsWith("#")) continue;
      out[line.slice(0, at).trim()] = line
        .slice(at + 1)
        .trim()
        .replace(/^(["'])([\s\S]*)\1$/, "$2");
    }
  } catch {
    // environment only
  }
  return out;
}
/**
 * The environment the application is actually running with.
 *
 * Not the .env file on disk: on this server those two disagree. The running
 * process has SUPABASE_URL pointing at the PostgREST in front of the migrated
 * database, and the file still names the hosted project the platform moved off.
 * A verification that read the file would test a database the application does
 * not use and report on leads nobody will ever see - which is exactly what
 * happened the first time this ran.
 *
 * seo-gate-run.mjs already reads the environment this way. Only variable names
 * are ever printed, never values.
 */
function appEnv() {
  const name = process.env.SV_PM2_NAME || "softwarevala-staging";
  let pid = "";
  try {
    pid = execSync(`pm2 pid ${name}`, { encoding: "utf8" }).replace(/[^0-9]/g, "");
  } catch {
    pid = "";
  }
  if (!pid) return {};
  try {
    const out = {};
    for (const item of readFileSync(`/proc/${pid}/environ`).toString("utf8").split("\0")) {
      const at = item.indexOf("=");
      if (at > 0) out[item.slice(0, at)] = item.slice(at + 1);
    }
    return out;
  } catch {
    return {};
  }
}

// The running application last, deliberately. A shell that has sourced the
// deployment's .env - which still names the hosted project the platform moved
// off - would otherwise override the very value this function exists to find,
// and the check would silently test the wrong database. It did exactly that
// the first time it was run this way.
const env = { ...readEnv(".env.ops"), ...process.env, ...appEnv() };
const BASE = (env.SUPABASE_URL || "").trim();
const KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!BASE || !KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed");
  process.exit(1);
}
const HEAD = { apikey: KEY, Authorization: `Bearer ${KEY}` };

/**
 * The read-back goes to the database directly, not over REST.
 *
 * Row level security refuses to serve `leads` to an unprivileged REST session,
 * which is precisely what it is there for - a visitor must never be able to
 * read the lead table. So this verification connects as the database, the way
 * the other operational scripts on this server do.
 */
const checks = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// ---------------------------------------------------- 1. pick a real slot
const slotRes = await fetch(
  `${BASE}/rest/v1/marketplace_card_slots?select=id,slot_url,country_marker,region,current_product_id&current_product_id=not.is.null&limit=1`,
  { headers: HEAD },
);
const slots = await slotRes.json();
const slot = slots[0];
if (!slot) {
  console.error("no occupied card slot to test with");
  process.exit(1);
}
// The product currently in the slot. A demo request is about a product, and
// the endpoint rightly refuses one that names none - so the test supplies the
// real occupant rather than weakening the endpoint to let the test through.
const productRes = await fetch(
  `${BASE}/rest/v1/marketplace_products?select=id,name&id=eq.${slot.current_product_id}&limit=1`,
  { headers: HEAD },
);
const product = (await productRes.json())[0] ?? null;

console.log(`site : ${SITE}`);
console.log(`slot : ${slot.slot_url}  (${slot.country_marker})`);
console.log(`product: ${product?.name ?? "(none)"}`);
console.log("");

// ------------------------------------- 2. post a capture as a browser would
const stamp = new Date().toISOString();
const marker = `e2e-${Date.now()}`;
const payload = {
  name: "SEO Attribution E2E Check",
  email: `${marker}@e2e.softwarevala.net`,
  phone: "+91 90000 00000",
  requirements: `Automated end-to-end check of the SEO to Lead Manager chain, ${stamp}.`,
  ctaAction: "request_demo",
  productName: product?.name ?? "",
  productId: product?.id ?? "",
  sourcePage: slot.slot_url,
  attribution: {
    landing_page: slot.slot_url,
    referrer: "https://www.google.com/search?q=software+vala+e2e",
    search_engine: "google",
    utm_source: "google",
    utm_medium: "organic",
    utm_campaign: "e2e-acceptance",
    utm_term: "e2e keyword",
    utm_content: "e2e creative",
    captured_at: stamp,
  },
};

console.log("posting one real capture...");
const post = await fetch(`${SITE}/api/marketplace/lead`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const posted = await post.json().catch(() => ({}));
check("the endpoint accepted the capture", post.ok, `HTTP ${post.status}`);
if (!post.ok) {
  console.log(`\n  response: ${JSON.stringify(posted).slice(0, 300)}`);
  process.exit(1);
}

// ------------------------------------------- 3. read the row back out of the DB
await new Promise((r) => setTimeout(r, 2500));
const leadRes = await fetch(
  `${BASE}/rest/v1/leads?select=*&email=eq.${encodeURIComponent(payload.email)}&limit=1`,
  { headers: HEAD },
);
const leads = leadRes.ok ? await leadRes.json() : [];
const lead = leads[0];
check("the lead reached the database", Boolean(lead), lead ? `id ${lead.id}` : "not found");
if (!lead) process.exit(1);

console.log("");
console.log("attribution recorded:");
check("source was derived, not hardcoded", lead.source === "seo", `source=${lead.source}`);
check(
  "the search engine was identified",
  lead.search_engine === "google",
  `search_engine=${lead.search_engine}`,
);
check(
  "the landing page was kept",
  lead.landing_page === slot.slot_url,
  `landing_page=${lead.landing_page}`,
);
check("the converting page was kept", Boolean(lead.source_page), `source_page=${lead.source_page}`);
check("the referrer was kept", Boolean(lead.referrer), String(lead.referrer).slice(0, 40));
check(
  "the campaign was read from the URL",
  lead.utm_campaign === "e2e-acceptance",
  `utm_campaign=${lead.utm_campaign}`,
);
check(
  "utm source and medium were kept",
  lead.utm_source === "google" && lead.utm_medium === "organic",
  `${lead.utm_source}/${lead.utm_medium}`,
);
check("the keyword was kept", lead.utm_term === "e2e keyword", `utm_term=${lead.utm_term}`);
check("the CTA was recorded", lead.cta_action === "request_demo", `cta_action=${lead.cta_action}`);
check(
  "the card slot was resolved",
  lead.card_slot_id === slot.id,
  `card_slot_id=${lead.card_slot_id}`,
);
check(
  "the product was attributed",
  lead.product_id === product?.id,
  `product_id=${lead.product_id}`,
);
check("the country came from the slot", Boolean(lead.country), `country=${lead.country}`);
check(
  "the whole envelope was kept",
  Boolean(lead.attribution && lead.attribution.source_reason),
  lead.attribution?.source_reason,
);

console.log("");
console.log("lead manager pipeline:");
check("the lead was scored", lead.ai_score !== null, `ai_score=${lead.ai_score}`);
check(
  "the lead was routed to an agent",
  Boolean(lead.assigned_agent_id),
  lead.assigned_agent_id ? "assigned" : "unassigned",
);
check(
  "a follow-up SLA was set",
  Boolean(lead.next_follow_up),
  `next_follow_up=${lead.next_follow_up}`,
);

/** One attribution question, asked of the database by indexed column. */
async function q(filter) {
  const res = await fetch(`${BASE}/rest/v1/leads?select=id&${filter}`, { headers: HEAD });
  return res.ok ? await res.json() : [];
}

// ---------------------------------------------- 4. can Lead Manager answer?
// The questions section 2 requires an answer to, asked of the database the way
// an aggregate on the Sources screen would ask them - by indexed column, not
// by scanning every lead.
const bySlot = await q(`card_slot_id=eq.${slot.id}`);
check(
  '"which leads came from this card slot?" is answerable',
  bySlot.length > 0,
  `${bySlot.length} lead(s) on ${slot.slot_url}`,
);
const byEngine = await q("search_engine=eq.google");
check(
  '"which leads came from Google?" is answerable',
  byEngine.length > 0,
  `${byEngine.length} lead(s)`,
);
const byCampaign = await q(
  `utm_campaign=eq.${encodeURIComponent(payload.attribution.utm_campaign)}`,
);
check(
  '"which leads came from this campaign?" is answerable',
  byCampaign.length > 0,
  `${byCampaign.length} lead(s)`,
);
const byLanding = await q(`landing_page=eq.${encodeURIComponent(slot.slot_url)}`);
check(
  '"which leads did this SEO page produce?" is answerable',
  byLanding.length > 0,
  `${byLanding.length} lead(s)`,
);

// ------------------------------------------------------------------ report
const failed = checks.filter((c) => !c.pass);
console.log("");
console.log(`lead id: ${lead.id}  (left in place — it is a real row)`);
console.log("");
if (failed.length) {
  console.log(
    `RESULT: ${checks.length - failed.length}/${checks.length} checks passed — ${failed.length} FAILED`,
  );
  process.exit(1);
}
console.log(`RESULT: all ${checks.length} checks passed.`);
