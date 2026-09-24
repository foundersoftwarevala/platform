/**
 * Give a card a title of its own where two categories share a name.
 *
 * The catalogue holds two categories called "Event Management" -
 * "event-management" at position 9 with 81 products, and "event-mgmt" at
 * position 91 with 80 - and both are real, both are the owner's data, and
 * neither may be renamed, merged or removed. Building a title from the
 * category name therefore produced the same title on two different pages, in
 * all eighty countries: 160 pages with a duplicate title.
 *
 * Nothing about the catalogue is touched here. Only the blueprint on the
 * lower-placed of the two categories' slots changes, and it changes to name the
 * product that is actually in the slot - real data about that page, and the one
 * thing that genuinely distinguishes it. The more prominent category keeps the
 * standard pattern.
 *
 * The title stays stable when the product rotates: it is the template that is
 * stored, and {product} is filled when the page renders. A slot with nobody in
 * it still reads correctly, because the renderer drops a separator left holding
 * nothing.
 *
 *   node scripts/ops/card-slots-dedupe-titles.mjs          # dry run
 *   node scripts/ops/card-slots-dedupe-titles.mjs --apply
 */
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const at = line.indexOf("=");
    if (at < 0 || line.trim().startsWith("#")) continue;
    out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return out;
}
const env = readEnv(".env.ops");
const BASE = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEAD = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function get(path) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, { headers: HEAD });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// Which category names are not unique. Found, not assumed: if the catalogue
// ever holds another pair, this handles it without being edited.
const categories = await get(
  "marketplace_categories?select=id,name,slug,sort_order&order=sort_order.asc",
);
const byName = new Map();
for (const category of categories) {
  if (!byName.has(category.name)) byName.set(category.name, []);
  byName.get(category.name).push(category);
}
const shared = [...byName.entries()].filter(([, list]) => list.length > 1);

console.log(`categories            : ${categories.length}`);
console.log(`names shared by two+  : ${shared.length}`);
for (const [name, list] of shared) {
  console.log(`  "${name}" -> ${list.map((c) => `${c.slug}(#${c.sort_order})`).join(", ")}`);
}
if (!shared.length) {
  console.log("\nNothing to do: every category name is unique.");
  process.exit(0);
}

// The first by sort order keeps the plain pattern; every later one names its
// product. Keeping the most prominent page unchanged is the smaller change.
const TITLE = "{category} Software in {country} — {product} | Software Vala";
const targets = [];
for (const [, list] of shared) {
  for (const category of list.slice(1)) targets.push(category);
}
console.log(`\ncategories to retitle : ${targets.map((c) => c.slug).join(", ")}`);

const rows = [];
for (const category of targets) {
  const slots = await get(
    "marketplace_card_slots?select=id,category_id,slot_no,country_marker,country_code,region," +
      `slot_url,meta_title_template&category_id=eq.${encodeURIComponent(category.id)}` +
      "&order=slot_no.asc",
  );
  console.log(`  ${category.slug}: ${slots.length} slots`);
  for (const slot of slots) {
    rows.push({
      id: slot.id,
      category_id: slot.category_id,
      slot_no: slot.slot_no,
      country_marker: slot.country_marker,
      country_code: slot.country_code,
      region: slot.region,
      slot_url: slot.slot_url,
      meta_title_template: TITLE,
    });
  }
}

console.log(`\nslots to update       : ${rows.length}`);
console.log(`new template          : ${TITLE}`);
console.log(
  "reads as              : " +
    TITLE.replace("{category}", "Event Management")
      .replace("{country}", "Angola")
      .replace("{product}", "EventPlannerCore"),
);
console.log(
  "when vacant           : " +
    TITLE.replace("{category}", "Event Management")
      .replace("{country}", "Angola")
      .replace("{product}", "")
      .replace(/\s{2,}/g, " ")
      .split("|")
      .map((p) =>
        p
          .trim()
          .replace(/^[—–-]+\s*/, "")
          .replace(/\s*[—–-]+$/, "")
          .trim(),
      )
      .filter((p) => /\p{L}|\p{N}/u.test(p))
      .join(" | "),
);

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply.");
  process.exit(0);
}

const res = await fetch(`${BASE}/rest/v1/marketplace_card_slots?on_conflict=id`, {
  method: "POST",
  headers: {
    ...HEAD,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal",
  },
  body: JSON.stringify(rows),
});
if (!res.ok) {
  console.error(`\nfailed — HTTP ${res.status}`);
  console.error((await res.text()).slice(0, 600));
  process.exit(1);
}
console.log(`\ndone — ${rows.length} slot titles now name their product`);
