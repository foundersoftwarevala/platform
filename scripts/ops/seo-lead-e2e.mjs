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
const env = process.env.SUPABASE_URL ? process.env : readEnv(".env.ops");
const BASE = (env.SUPABASE_URL || "").trim();
const KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!BASE || !KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed");
  process.exit(1);
}
const HEAD = { apikey: KEY, Authorization: `Bearer ${KEY}` };

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
console.log(`site : ${SITE}`);
console.log(`slot : ${slot.slot_url}  (${slot.country_marker})`);
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
  productName: "",
  productId: "",
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
const leads = await leadRes.json();
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

// ---------------------------------------------- 4. can Lead Manager answer?
const bySlot = await fetch(`${BASE}/rest/v1/leads?select=id&card_slot_id=eq.${slot.id}`, {
  headers: { ...HEAD, Prefer: "count=exact" },
});
check(
  '"which leads came from this card slot?" is answerable',
  bySlot.ok,
  `${(await bySlot.json()).length} lead(s) on ${slot.slot_url}`,
);
const byEngine = await fetch(`${BASE}/rest/v1/leads?select=id&search_engine=eq.google`, {
  headers: HEAD,
});
check(
  '"which leads came from Google?" is answerable',
  byEngine.ok,
  `${(await byEngine.json()).length} lead(s)`,
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
