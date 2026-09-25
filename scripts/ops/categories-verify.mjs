/**
 * Every category page the site serves, checked one by one.
 *
 * The acceptance script samples a handful of each kind of page, which is right
 * for a broad sweep and wrong for the question "are all ninety-one of them
 * sound". Ninety-one category pages once shared a single title and listed
 * products they never linked to, and a sample of twelve is how that survived;
 * a sample of twelve is also how a single category that had stopped answering
 * at all was nearly missed.
 *
 * So this asks for every category in the database and fetches every one of its
 * pages, reporting the count that passed out of the count that exists. It reads
 * the HTML the server sends, not a browser's DOM, because that is what a
 * crawler is given.
 *
 *   node scripts/ops/categories-verify.mjs
 *   node scripts/ops/categories-verify.mjs https://softwarevala.net
 */
import { readFileSync } from "node:fs";

const SITE = (process.argv[2] || process.env.SV_SITE || "https://softwarevala.net").replace(
  /\/+$/,
  "",
);

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
    // The environment was the only source anyway.
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

async function rest(path) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, { headers: HEAD });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

const one = (html, re) => {
  const m = html.match(re);
  return m ? m[1].trim() : null;
};

// ------------------------------------------------------------ the categories
const categories = await rest(
  "marketplace_categories?select=slug,name&is_hidden=eq.false&order=slug",
);
console.log(`site       : ${SITE}`);
console.log(`categories : ${categories.length}`);
console.log("");

const titles = new Map();
const canonicals = new Map();
const failures = [];
const rows = [];

for (const category of categories) {
  const path = `/marketplace/category/${category.slug}`;
  const url = `${SITE}${path}`;
  const problems = [];

  let html = "";
  let status = 0;
  let ms = 0;
  const started = Date.now();
  try {
    // Generous, because the point is to catch a page that is slow rather than
    // to time out alongside it and report the same thing as a network error.
    const res = await fetch(url, { signal: AbortSignal.timeout(75_000) });
    status = res.status;
    html = await res.text();
  } catch (error) {
    problems.push(`did not answer: ${String(error).slice(0, 80)}`);
  }
  ms = Date.now() - started;

  if (status && status !== 200) problems.push(`HTTP ${status}`);

  if (html) {
    const title = one(html, /<title[^>]*>([^<]*)<\/title>/i);
    const canonical = one(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    const h1 = one(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const robots = one(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);

    if (!title) problems.push("no title");
    if (!canonical) problems.push("no canonical");
    if (!h1) problems.push("no H1");
    if (robots && /noindex/i.test(robots)) problems.push(`robots="${robots}"`);

    if (canonical && canonical !== url) problems.push(`canonical points elsewhere: ${canonical}`);

    // The failure this page class actually had: it listed its products and
    // linked to none of them, so a crawler could reach nothing from here.
    const productLinks = new Set(
      [...html.matchAll(/href=["']([^"']*\/marketplace\/product\/[^"']+)["']/g)].map((m) => m[1]),
    );
    if (productLinks.size === 0) problems.push("no product links");

    if (title) {
      const seen = titles.get(title);
      if (seen) problems.push(`title shared with ${seen}`);
      else titles.set(title, path);
    }
    if (canonical) {
      const seen = canonicals.get(canonical);
      if (seen) problems.push(`canonical shared with ${seen}`);
      else canonicals.set(canonical, path);
    }

    rows.push({ path, links: productLinks.size, ms });
  }

  if (problems.length) failures.push(`${path} — ${problems.join("; ")}`);
}

// ------------------------------------------------------------------- report
const passed = categories.length - failures.length;
const slowest = [...rows].sort((a, b) => b.ms - a.ms).slice(0, 5);
const linkless = rows.filter((r) => r.links === 0).length;

console.log(
  `product links: min ${Math.min(...rows.map((r) => r.links))}, ` +
    `max ${Math.max(...rows.map((r) => r.links))}, ` +
    `pages with none ${linkless}`,
);
console.log(`distinct titles: ${titles.size}/${rows.length}`);
console.log(`slowest: ${slowest.map((r) => `${r.path} ${r.ms}ms`).join(", ")}`);
console.log("");

if (failures.length) {
  console.log(`RESULT: ${passed}/${categories.length} — ${failures.length} failing`);
  for (const line of failures.slice(0, 25)) console.log(`  ${line}`);
  if (failures.length > 25) console.log(`  ... and ${failures.length - 25} more`);
  process.exit(1);
}

console.log(`RESULT: ${passed}/${categories.length} category pages pass.`);
