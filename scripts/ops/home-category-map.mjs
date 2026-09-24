import { readFileSync, writeFileSync } from "node:fs";
function readEnv(f) {
  const o = {};
  for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return o;
}
const ops = readEnv(".env.ops");
const h = { apikey: ops.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${ops.SUPABASE_SERVICE_ROLE_KEY}` };

const src = readFileSync("src/data/extraDemos.ts", "utf8");
const block = src.slice(src.indexOf("export const allMasterCategories55"));
const masters = [...block.slice(0, block.indexOf("];")).matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const cats = await (await fetch(`${ops.SUPABASE_URL}/rest/v1/marketplace_categories?select=id,slug,name&is_hidden=eq.false&limit=200`, { headers: h })).json();
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const byName = new Map(cats.map((c) => [norm(c.name), c]));
const bySlug = new Map(cats.map((c) => [norm(c.slug), c]));

// The three the names do not settle by themselves.
const ALIAS = {
  "Enterprise Resource Planning (ERP)": "erp",
  "Government & e-Governance Systems": "government-services",
  "Automobile": "automotive",
};

const pairs = [];
const unresolved = [];
for (const m of masters) {
  if (ALIAS[m]) {
    const hit = cats.find((c) => c.slug === ALIAS[m]);
    if (hit) { pairs.push([m, hit.slug, hit.name]); continue; }
  }
  const hit = byName.get(norm(m)) ?? bySlug.get(norm(m))
    ?? cats.find((c) => norm(c.name) === norm(m))
    ?? cats.find((c) => norm(c.name).startsWith(norm(m)) || norm(m).startsWith(norm(c.name)));
  if (hit) pairs.push([m, hit.slug, hit.name]);
  else unresolved.push(m);
}

const lines = pairs.map(([m, slug, name]) => `  ${JSON.stringify(m)}: ${JSON.stringify(slug)},${name === m ? "" : ` // ${name}`}`);
const file = `/**
 * Which catalogue row a home page shelf is.
 *
 * The home page groups its shelves by a masterCategory string held in the
 * code; the catalogue groups its products by a row in marketplace_categories.
 * They are the same shelves under two names, and this says which is which so
 * a shelf can be filled with the real products the catalogue holds for it.
 *
 * Three of them do not settle by name alone and are named here on purpose:
 * "Enterprise Resource Planning (ERP)" is the erp row, "Government &
 * e-Governance Systems" is government-services, and "Automobile" is
 * automotive.
 *
 * A shelf with no catalogue row keeps exactly what it has today.
 *
 * Generated from the live catalogue by scripts/ops/home-category-map.mjs.
 */

export const HOME_CATEGORY_SLUG: Record<string, string> = {
${lines.join("\n")}
};

/** The catalogue row for a shelf, or null when the shelf has none. */
export function catalogueSlugForShelf(masterCategory: string): string | null {
  return HOME_CATEGORY_SLUG[masterCategory] ?? null;
}
`;
writeFileSync("src/lib/marketplace/home-category-map.ts", file.replace(/\r?\n/g, "\r\n"));
console.log(`shelves: ${masters.length}, mapped: ${pairs.length}, unresolved: ${unresolved.length}`);
if (unresolved.length) console.log("unresolved:", unresolved.join(", "));
