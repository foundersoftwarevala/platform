/**
 * Move one product from the country it shares to the country nobody holds.
 *
 * The Event Management row covered seventy-nine of the eighty countries: two
 * products carried Angola and none carried Kazakhstan, so the row's cards fell
 * one place out of step from position fifty-nine onward and no longer agreed
 * with any other row. SiteVisitEvent holds Angola's own grid slot and names it
 * in forty-one of its forty-four keywords, so it is Angola's product and is
 * not touched. CrewCall Suite is the second one, its name and slug carry no
 * country, and it has no SEO page record - so it is the one that moves.
 *
 * Only search_keywords changes, and only the entries that name a place:
 * the country marker, the phrases that say Angola, and the five that say
 * Africa, which becomes Central Asia because that is the region
 * src/lib/marketplace/rail-countries.ts records for Kazakhstan. The product's
 * name, slug, category, price, description, tags, visibility, status and
 * sort order are left exactly as they are, so its address does not move and
 * nothing linking to it breaks.
 *
 * Nothing is created and nothing is deleted.
 *
 *   node scripts/ops/retarget-crewcall-kazakhstan.mjs           report only
 *   node scripts/ops/retarget-crewcall-kazakhstan.mjs --apply   write it
 */
import { readFileSync, writeFileSync } from "node:fs";

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return out;
}

const ops = readEnv(".env.ops");
const base = ops.SUPABASE_URL;
const h = {
  apikey: ops.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${ops.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};
const apply = process.argv.includes("--apply");

const ID = "d5792fad-3ff9-4800-8885-6c6b410c79dc";
const FROM_COUNTRY = "Angola";
const TO_COUNTRY = "Kazakhstan";
const FROM_REGION = "Africa";
const TO_REGION = "Central Asia";
// The city too. Luanda is Angola's capital, and leaving it behind would have
// left a Kazakhstan product bidding on an Angolan city - the same
// cannibalisation this change exists to remove. Almaty is not a guess: the
// catalogue already pairs Kazakhstan with Almaty on thirty other products,
// and SiteVisitEvent, which keeps Angola, carries no Luanda keyword at all.
const FROM_CITY = "Luanda";
const TO_CITY = "Almaty";

const [row] = await (await fetch(`${base}/rest/v1/marketplace_products?select=*&id=eq.${ID}`, { headers: h })).json();
if (!row) { console.error("the product is not there"); process.exit(1); }
if (row.name !== "CrewCall Suite") { console.error(`expected CrewCall Suite, found ${row.name}`); process.exit(1); }

const before = row.search_keywords ?? [];
const swapPlace = (entry) =>
  entry
    .split(FROM_COUNTRY).join(TO_COUNTRY)
    .split(FROM_COUNTRY.toLowerCase()).join(TO_COUNTRY)
    .split(FROM_REGION).join(TO_REGION)
    .split(FROM_REGION.toLowerCase()).join(TO_REGION)
    .split(FROM_CITY).join(TO_CITY)
    .split(FROM_CITY.toLowerCase()).join(TO_CITY);

const after = before.map(swapPlace);
const changed = before.map((b, i) => [b, after[i]]).filter(([b, a]) => b !== a);

console.log(`product     ${row.name} (${row.slug})`);
console.log(`keywords    ${before.length} entries`);
console.log(`changed     ${changed.length}`);
console.log(`  marker now: ${after.filter((k) => k.startsWith("country:")).join(", ")}`);
console.log(`  still naming ${FROM_COUNTRY}: ${after.filter((k) => new RegExp(FROM_COUNTRY, "i").test(k)).length}`);
console.log(`  still naming ${FROM_REGION}: ${after.filter((k) => new RegExp(FROM_REGION, "i").test(k)).length}`);
console.log(`  still naming ${FROM_CITY}: ${after.filter((k) => new RegExp(FROM_CITY, "i").test(k)).length}`);
console.log(`  city marker now: ${after.filter((k) => k.startsWith("city:")).join(", ") || "(none)"}`);
console.log(`  region marker now: ${after.filter((k) => k.startsWith("region:")).join(", ") || "(none)"}`);
console.log(`\nthe diff, every changed entry:`);
for (const [b, a] of changed) console.log(`  - ${b}\n  + ${a}`);
console.log(`\nunchanged entries: ${before.length - changed.length}`);
for (const k of before.filter((b, i) => b === after[i])) console.log(`    ${k}`);

writeFileSync("C:/Users/oooo/AppData/Local/Temp/claude/crewcall-diff.json", JSON.stringify({ before, after, changed }, null, 1));

if (!apply) { console.log(`\nnothing written. run with --apply.`); process.exit(0); }

const res = await fetch(`${base}/rest/v1/marketplace_products?id=eq.${ID}`, {
  method: "PATCH",
  headers: { ...h, Prefer: "return=representation" },
  body: JSON.stringify({ search_keywords: after }),
});
if (!res.ok) { console.error(`the write failed: ${res.status} ${(await res.text()).slice(0, 200)}`); process.exit(1); }
const [written] = await res.json();
console.log(`\nwritten. the row now carries ${written.search_keywords.length} keywords, marker ${written.search_keywords.filter((k) => k.startsWith("country:")).join(", ")}`);

// Every other column, compared field by field against what was read a moment ago.
const drift = Object.keys(row).filter(
  (k) => k !== "search_keywords" && k !== "updated_at" && JSON.stringify(row[k]) !== JSON.stringify(written[k]),
);
console.log(`columns other than search_keywords that changed: ${drift.length}${drift.length ? " -> " + drift.join(", ") : " (none)"}`);
