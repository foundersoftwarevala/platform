/**
 * Generate the canonical card slots: one per category, per country.
 *
 * A slot is a permanent address - a category and a place in the country rail -
 * that owns its URL and its SEO blueprint. The product inside it is a tenant
 * and may be replaced without the slot moving. This writes the slot grid the
 * catalogue already implies, and points each slot at whichever published
 * product currently holds that country in that category.
 *
 * The country order is read from src/lib/marketplace/rail-countries.ts and
 * nowhere else, so there is exactly one country list in the project. The
 * categories are read from the database. Nothing here invents a country, a
 * country code, a category or a product.
 *
 * A slot with no product is written as vacant. That is a reported gap, never a
 * missing card.
 *
 *   node scripts/ops/card-slots-generate.mjs            # dry run, writes nothing
 *   node scripts/ops/card-slots-generate.mjs --apply    # insert/update the grid
 */
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");

// ----------------------------------------------------------------- the env
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
if (!BASE || !KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed in .env.ops");
  process.exit(1);
}
const HEAD = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function readAll(path) {
  const rows = [];
  let from = 0;
  for (;;) {
    const res = await fetch(`${BASE}/rest/v1/${path}`, {
      headers: { ...HEAD, Range: `${from}-${from + 999}` },
    });
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
    from += 1000;
  }
}

// --------------------------------------------------- the one country list
/**
 * The rail, parsed from the TypeScript that publishes it. Reading the file
 * rather than repeating its contents is the point: adding a country there adds
 * a slot to every category here, and the two can never drift apart.
 */
function railCountries() {
  const source = readFileSync("src/lib/marketplace/rail-countries.ts", "utf8");
  const start = source.indexOf("RAIL_COUNTRIES: RailCountry[] = [");
  if (start < 0) throw new Error("RAIL_COUNTRIES not found in rail-countries.ts");
  const end = source.indexOf("\n];", start);
  const body = source.slice(start, end < 0 ? source.length : end);

  const field = (line, name) => {
    const at = line.indexOf(`${name}: `);
    if (at < 0) return null;
    const rest = line.slice(at + name.length + 2).trim();
    if (rest.startsWith("null")) return null;
    const quote = rest[0];
    if (quote !== '"' && quote !== "'") return null;
    return rest.slice(1, rest.indexOf(quote, 1));
  };

  const out = [];
  for (const line of body.split("\n")) {
    if (!line.trim().startsWith("{ marker:")) continue;
    const marker = field(line, "marker");
    if (!marker) continue;
    out.push({
      marker,
      label: field(line, "label") ?? marker,
      code: field(line, "code"),
      continent: field(line, "continent"),
      region: field(line, "region"),
    });
  }
  return out;
}

/** The same slug the country pages already use, so the two agree. */
function countrySlug(country) {
  return country
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The country a product is written for: "country:<name>" in search_keywords. */
function productCountry(keywords) {
  if (!Array.isArray(keywords)) return null;
  const marker = keywords.find((k) => typeof k === "string" && k.startsWith("country:"));
  return marker ? marker.slice("country:".length) : null;
}

/** The region a product claims: "region:<name>" in search_keywords. */
function productRegion(keywords) {
  if (!Array.isArray(keywords)) return null;
  const marker = keywords.find((k) => typeof k === "string" && k.startsWith("region:"));
  return marker ? marker.slice("region:".length) : null;
}

// ------------------------------------------------------------------- main
const countries = railCountries();
const categories = await readAll(
  "marketplace_categories?select=id,slug,name,sort_order&order=sort_order.asc,name.asc",
);
const products = await readAll(
  "marketplace_products?select=id,name,category_id,search_keywords,sort_order" +
    "&visible=eq.true&content_status=eq.published&order=sort_order.asc,name.asc",
);

console.log(`rail countries : ${countries.length}`);
console.log(`categories     : ${categories.length}`);
console.log(`published rows : ${products.length}`);
console.log(`slots expected : ${categories.length} x ${countries.length} = ${categories.length * countries.length}`);

const byMarker = new Map(countries.map((c) => [c.marker, c]));

// The catalogue's own country-to-region convention, read from the products
// rather than decided here. It is continent-level - Africa, Asia, Middle East,
// Europe, Oceania, North America, South America - and where a country's
// products disagree the commonest answer wins, so the single
// "region:Central Asia" on one Kazakhstan product is recorded and reported
// without being rewritten. A country whose products carry no region marker at
// all is left null rather than guessed.
const regionVotes = new Map();
for (const product of products) {
  const marker = productCountry(product.search_keywords);
  const region = productRegion(product.search_keywords);
  if (!marker || !region) continue;
  if (!regionVotes.has(marker)) regionVotes.set(marker, new Map());
  const votes = regionVotes.get(marker);
  votes.set(region, (votes.get(region) ?? 0) + 1);
}
const regionOf = new Map();
const regionSplit = [];
for (const [marker, votes] of regionVotes) {
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  regionOf.set(marker, ranked[0][0]);
  if (ranked.length > 1) {
    regionSplit.push(`${marker}: ${ranked.map(([r, n]) => `${r} x${n}`).join(", ")}`);
  }
}
const regionUnknown = countries.filter((c) => !regionOf.has(c.marker)).map((c) => c.marker);

// Which product holds which country in which category. The first in catalogue
// order takes the country, which is the rule the live country rail already
// uses, so the grid this writes matches the grid the home page draws.
const heldBy = new Map();      // `${category_id}|${marker}` -> product
const contested = [];          // a second product marked for a taken country
let noCountry = 0;
let offRail = 0;
for (const product of products) {
  if (!product.category_id) continue;
  const marker = productCountry(product.search_keywords);
  if (!marker) { noCountry += 1; continue; }
  if (!byMarker.has(marker)) { offRail += 1; continue; }
  const key = `${product.category_id}|${marker}`;
  if (heldBy.has(key)) contested.push({ key, product: product.name });
  else heldBy.set(key, product);
}

const rows = [];
for (const category of categories) {
  countries.forEach((country, index) => {
    const tenant = heldBy.get(`${category.id}|${country.marker}`) ?? null;
    rows.push({
      category_id: category.id,
      slot_no: index + 1,
      country_marker: country.marker,
      country_code: country.code,
      // The catalogue's own convention, read above. Null where the catalogue
      // has never said, which is reported rather than filled in.
      region: regionOf.get(country.marker) ?? null,
      slot_url: `/marketplace/${category.slug}/${countrySlug(country.marker)}`,
      slot_title: `${category.name} Software in ${country.label}`,
      hreflang_group: `category:${category.slug}`,
      current_product_id: tenant ? tenant.id : null,
      occupied_since: tenant ? new Date().toISOString() : null,
      status: tenant ? "occupied" : "vacant",
      rotation_policy: "manual",
    });
  });
}

// ------------------------------------------------------------ the checks
const positions = new Set(rows.map((r) => `${r.category_id}|${r.slot_no}`));
const addresses = new Set(rows.map((r) => `${r.category_id}|${r.country_marker}`));
const urls = new Set(rows.map((r) => r.slot_url));
const occupied = rows.filter((r) => r.status === "occupied").length;
const vacant = rows.length - occupied;

console.log("");
console.log(`rows built              : ${rows.length}`);
console.log(`unique category+slot_no : ${positions.size}`);
console.log(`unique category+country : ${addresses.size}`);
console.log(`unique slot_url         : ${urls.size}`);
console.log(`occupied / vacant       : ${occupied} / ${vacant}`);
console.log(`products with no country: ${noCountry}`);
console.log(`products off the rail   : ${offRail}`);
console.log(`contested countries     : ${contested.length}`);
console.log(`countries with no region: ${regionUnknown.length}${regionUnknown.length ? " -> " + regionUnknown.join(", ") : ""}`);
for (const line of regionSplit) console.log(`  region disagreement   : ${line}`);

const problems = [];
if (rows.length !== categories.length * countries.length) problems.push("row count is not categories x countries");
if (positions.size !== rows.length) problems.push("a category holds two slots at the same position");
if (addresses.size !== rows.length) problems.push("a category holds two slots for the same country");
if (urls.size !== rows.length) problems.push("two slots share a URL");
if (problems.length) {
  console.error("\nREFUSED — " + problems.join("; "));
  process.exit(1);
}

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Sample:");
  for (const row of [rows[0], rows[1], rows[countries.length], rows.at(-1)]) {
    console.log(`  #${row.slot_no} ${row.slot_url} -> ${row.status}`);
  }
  console.log("\nRe-run with --apply to write the grid.");
  process.exit(0);
}

// ------------------------------------------------------------- the write
// Upsert on the address, so re-running leaves an existing slot in place and
// only fills what is missing. A slot is never deleted here.
let written = 0;
for (let at = 0; at < rows.length; at += 500) {
  const batch = rows.slice(at, at + 500);
  const res = await fetch(
    `${BASE}/rest/v1/marketplace_card_slots?on_conflict=category_id,country_marker`,
    {
      method: "POST",
      headers: {
        ...HEAD,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(batch),
    },
  );
  if (!res.ok) {
    console.error(`\nbatch at ${at} failed — HTTP ${res.status}`);
    console.error((await res.text()).slice(0, 600));
    process.exit(1);
  }
  written += batch.length;
  console.log(`  written ${written}/${rows.length}`);
}

const after = await fetch(`${BASE}/rest/v1/marketplace_card_slots?select=id&limit=1`, {
  headers: { ...HEAD, Prefer: "count=exact", Range: "0-0" },
});
const total = Number((after.headers.get("content-range") ?? "").split("/")[1]);
console.log(`\ndone — marketplace_card_slots now holds ${total} rows`);
