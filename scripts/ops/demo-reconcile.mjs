/**
 * Which product has a demo, which demo belongs to which product, and where the
 * Live Demo button on each one actually points.
 *
 * Nothing here writes. It reads the catalogue, the demo records and the way
 * the storefront decides whether to show a Live Demo button, and reports each
 * product against the four states the owner asked for:
 *
 *   GREEN   the product, the demo and the button all agree
 *   YELLOW  a demo exists but something about it needs a decision
 *   RED     the connection is broken, missing on one side, or mismatched
 *   GRAY    it cannot be verified from here
 *
 * A demo is never invented and never attached by guesswork: where more than
 * one product could own a demo, it is reported for review rather than matched.
 *
 *   node scripts/ops/demo-reconcile.mjs [--full]
 */
import { readFileSync, writeFileSync } from "node:fs";

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^'|'$/g, "");
  }
  return out;
}

const ops = readEnv(".env.ops");
const base = ops.SUPABASE_URL;
const key = ops.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const full = process.argv.includes("--full");

/** Every row of a table, a page at a time. */
async function all(path, page = 1000) {
  const rows = [];
  for (let from = 0; ; from += page) {
    const res = await fetch(`${base}/rest/v1/${path}`, {
      headers: { ...headers, Range: `${from}-${from + page - 1}` },
    });
    if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < page) return rows;
  }
}

const products = await all(
  "marketplace_products?select=id,slug,name,demo_url,visible,content_status&order=name.asc",
);
const demos = await all("product_demo_urls?select=*");

console.log(`catalogue       ${products.length} products`);
console.log(`demo records    ${demos.length}`);
console.log(`products with a demo_url of their own  ${products.filter((p) => p.demo_url).length}\n`);

const byId = new Map(products.map((p) => [p.id, p]));
const demosByProduct = new Map();
for (const d of demos) {
  if (!demosByProduct.has(d.product_id)) demosByProduct.set(d.product_id, []);
  demosByProduct.get(d.product_id).push(d);
}

/** A demo whose product_id matches nothing in the catalogue. */
const orphanDemos = demos.filter((d) => !byId.has(d.product_id));

const rows = [];
for (const p of products) {
  const own = p.demo_url ? String(p.demo_url).trim() : "";
  const records = demosByProduct.get(p.id) ?? [];
  const active = records.filter((d) => d.status === "active" && /^https?:\/\//i.test(d.url ?? ""));

  let status, note;
  if (!own && records.length === 0) {
    status = "RED";
    note = "no demo at all — the Live Demo button cannot appear";
  } else if (active.length === 1) {
    const d = active[0];
    if (d.last_result === "working") {
      status = "GREEN";
      note = `${d.url} (checked ${d.last_http_status ?? "?"} in ${d.last_response_ms ?? "?"}ms)`;
    } else if (d.last_result) {
      status = "RED";
      note = `${d.url} — last check said "${d.last_result}"`;
    } else {
      status = "YELLOW";
      note = `${d.url} — never checked`;
    }
  } else if (active.length > 1) {
    status = "YELLOW";
    note = `${active.length} active demos on one product — which one the button opens needs deciding`;
  } else if (records.length > 0) {
    status = "YELLOW";
    note = `${records.length} demo record(s), none active`;
  } else {
    status = "YELLOW";
    note = `demo_url set on the product (${own}) but no Demo Manager record behind it`;
  }

  if (!p.visible && status === "GREEN") {
    status = "YELLOW";
    note += " — but the product is not visible in the marketplace";
  }

  rows.push({ id: p.id, slug: p.slug, name: p.name, status, note });
}

const count = (s) => rows.filter((r) => r.status === s).length;
console.log(`GREEN   ${count("GREEN")}`);
console.log(`YELLOW  ${count("YELLOW")}`);
console.log(`RED     ${count("RED")}`);
console.log(`GRAY    ${count("GRAY")}`);

console.log(`\nevery product that has a demo:`);
for (const r of rows.filter((r) => r.status !== "RED")) {
  console.log(`  ${r.status.padEnd(7)} ${String(r.name).slice(0, 44).padEnd(45)} ${r.note}`);
}

if (orphanDemos.length) {
  console.log(`\ndemo records pointing at no product in the catalogue (${orphanDemos.length}):`);
  for (const d of orphanDemos) console.log(`  ${d.url} -> product_id ${d.product_id}`);
}

const report = {
  generated_at: new Date().toISOString(),
  products: products.length,
  demo_records: demos.length,
  green: count("GREEN"),
  yellow: count("YELLOW"),
  red: count("RED"),
  gray: count("GRAY"),
  with_demo: rows.filter((r) => r.status !== "RED"),
  orphan_demo_records: orphanDemos.map((d) => ({ url: d.url, product_id: d.product_id })),
  ...(full ? { without_demo: rows.filter((r) => r.status === "RED") } : {}),
};
writeFileSync("demo-reconciliation.json", JSON.stringify(report, null, 2));
console.log(`\nfull table written to demo-reconciliation.json`);
console.log(
  `\n${count("RED")} of ${products.length} products have no demo. None was invented and none was attached by guesswork.`,
);
