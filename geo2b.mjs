/**
 * Build the batch, check it, and report. Inserts only with --insert.
 */
import { readEnv, NEW_20, REGION, slugify, norm, subject, intents, save } from "./geo2a.mjs";

const ops = readEnv(".env.ops");
const h = {
  apikey: ops.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${ops.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};
const base = ops.SUPABASE_URL;
const insert = process.argv.includes("--insert");

const cats = await (
  await fetch(
    `${base}/rest/v1/marketplace_categories?select=id,slug,name,icon&is_hidden=eq.false&order=sort_order.asc&limit=300`,
    { headers: h },
  )
).json();
const registry = await (
  await fetch(`${base}/rest/v1/registry_countries?select=code,name,region&limit=300`, {
    headers: h,
  })
).json();
const regByName = new Map(registry.map((r) => [norm(r.name), r]));
const ALIAS = { czechia: "czechrepublic", taiwan: "taiwanprovinceofchina" };

const countries = NEW_20.map((name) => {
  const key = norm(name);
  const hit =
    regByName.get(key) ??
    regByName.get(ALIAS[key] ?? "") ??
    [...regByName.values()].find(
      (x) => norm(x.name).startsWith(key) || key.startsWith(norm(x.name)),
    );
  if (!hit) throw new Error(`no registry row for ${name}`);
  return { name, code: hit.code, continent: hit.region, region: REGION[hit.code] ?? hit.region };
});

const taken = new Set();
for (let offset = 0; ; offset += 1000) {
  const page = await (
    await fetch(`${base}/rest/v1/marketplace_products?select=slug&limit=1000&offset=${offset}`, {
      headers: h,
    })
  ).json();
  if (!Array.isArray(page) || page.length === 0) break;
  for (const p of page) taken.add(p.slug);
  if (page.length < 1000) break;
}

const highest = new Map();
for (const c of cats) {
  const rows = await (
    await fetch(
      `${base}/rest/v1/marketplace_products?select=sort_order&category_id=eq.${c.id}&order=sort_order.desc&limit=1`,
      { headers: h },
    )
  ).json();
  highest.set(c.id, Number(rows[0]?.sort_order ?? 0));
}

const records = [];
const collisions = [];
for (const cat of cats) {
  const start = highest.get(cat.id) ?? 0;
  countries.forEach((country, index) => {
    const slug = `${slugify(cat.name)}-${slugify(country.name)}`;
    if (taken.has(slug)) {
      collisions.push(slug);
      return;
    }
    taken.add(slug);
    records.push({
      slug,
      name: `${subject(cat.name)} — ${country.name}`,
      category_id: cat.id,
      industry_label: cat.name,
      subcategory: cat.name,
      icon: cat.icon ?? null,
      description:
        `${subject(cat.name)} listed for ${country.name} (${country.region}). ` +
        `A catalogue entry for the ${cat.name.toLowerCase()} category in ${country.name}; its features, ` +
        `technology and price are recorded when the actual software is attached to it.`,
      search_keywords: intents(cat.name, country.name, country.region),
      tags: [slugify(cat.name), "geo-batch-2", "test-dataset", `country-${slugify(country.name)}`],
      target_audience: `${cat.name} businesses and teams in ${country.name}`,
      visible: true,
      content_status: "published",
      sort_order: start + 1 + index,
      price_label: null,
      price_period: null,
      features: [],
      tech_stack: [],
      technology: null,
      demo_url: null,
      rating: 0,
      downloads: 0,
    });
  });
}

const slugs = records.map((r) => r.slug);
const dup = slugs.filter((s, i) => slugs.indexOf(s) !== i);
const counts = records.map((r) => r.search_keywords.length);
console.log(`categories ${cats.length}   countries ${countries.length}`);
console.log(`records built ${records.length}  (expected ${cats.length * countries.length})`);
console.log(`slug collisions with the catalogue: ${collisions.length}`);
console.log(`duplicate slugs inside the batch: ${dup.length}`);
console.log(`intents per record: min ${Math.min(...counts)}  max ${Math.max(...counts)}`);
const one = records[0];
console.log(`\n--- one record ---`);
console.log(`slug   ${one.slug}`);
console.log(`name   ${one.name}`);
console.log(`desc   ${one.description}`);
console.log(`tags   ${JSON.stringify(one.tags)}`);
console.log(`intents (first 14 of ${one.search_keywords.length}):`);
for (const k of one.search_keywords.slice(0, 14)) console.log(`   ${k}`);
console.log(`last:  ${one.search_keywords[one.search_keywords.length - 1]}`);
console.log(`\n--- same category, three countries ---`);
for (const r of records.filter((x) => x.category_id === cats[0].id).slice(0, 3))
  console.log(`  ${String(r.sort_order).padStart(5)}  ${r.slug.padEnd(40)} ${r.name}`);
console.log(`--- three categories, one country ---`);
for (const r of records.filter((x) => x.slug.endsWith("-taiwan")).slice(0, 3))
  console.log(`         ${r.slug.padEnd(40)} ${r.name}`);

save("C:/Users/oooo/AppData/Local/Temp/claude/geo2-records.json", records);

if (!insert) {
  console.log(`\nnothing inserted. run with --insert to write ${records.length} rows.`);
  process.exit(0);
}

let written = 0;
const failures = [];
for (let i = 0; i < records.length; i += 100) {
  const batch = records.slice(i, i + 100);
  const res = await fetch(`${base}/rest/v1/marketplace_products`, {
    method: "POST",
    headers: { ...h, Prefer: "return=minimal" },
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    failures.push(`${i}-${i + batch.length}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    continue;
  }
  written += batch.length;
  console.log(`  wrote ${written}/${records.length}`);
}
console.log(`\ninserted ${written} of ${records.length}`);
for (const f of failures) console.log(`  FAILED ${f}`);
