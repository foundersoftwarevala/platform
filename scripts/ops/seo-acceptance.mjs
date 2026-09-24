/**
 * Check the live site against the SEO acceptance criteria, from the outside.
 *
 * Everything here reads the HTML the server actually sends - not a browser's
 * DOM after JavaScript has run - because that is what a crawler gets and it is
 * the only version whose contents can be claimed. A page that looks complete
 * in a browser and arrives as a shell is reported as a shell.
 *
 * It samples every kind of page the architecture has, not ten pages of one
 * kind: slots, products, categories, countries, the blog, the hubs and the
 * machinery (sitemaps, robots). The sample size per kind is an argument, so the
 * same script serves a quick check and a deep one.
 *
 *   node scripts/ops/seo-acceptance.mjs              # 12 of each kind
 *   node scripts/ops/seo-acceptance.mjs 40           # 40 of each kind
 *   node scripts/ops/seo-acceptance.mjs 12 https://softwarevala.net
 */
import { readFileSync } from "node:fs";

const PER_KIND = Number(process.argv[2] ?? 12) || 12;
const SITE = (process.argv[3] || "https://softwarevala.net").replace(/\/+$/, "");

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const at = line.indexOf("=");
    if (at < 0 || line.trim().startsWith("#")) continue;
    out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return out;
}
const env = process.env.SUPABASE_URL ? process.env : readEnv(".env.ops");
const BASE = (env.SUPABASE_URL || "").trim();
const KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const HEAD = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function rest(path) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, { headers: HEAD });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

// ------------------------------------------------------------- the checks
const findings = [];
const note = (severity, area, url, detail) => findings.push({ severity, area, url, detail });

const one = (html, re) => {
  const m = html.match(re);
  return m ? m[1].trim() : null;
};
const many = (html, re) => [...html.matchAll(re)].map((m) => m[1]);

const text = (html) =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const normalise = (url) => {
  let path = String(url).replace(SITE, "");
  const q = path.indexOf("?");
  if (q >= 0) path = path.slice(0, q);
  while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path || "/";
};

/**
 * One page, measured.
 *
 * `expect` says what the architecture promises for this kind of page, so a
 * category page is not marked down for having no hreflang and a slot page is
 * marked down for having the wrong number of them.
 */
async function measure(path, kind, expect) {
  const url = SITE + path;
  let res;
  let html;
  try {
    res = await fetch(url, { redirect: "manual" });
    html = await res.text();
  } catch (error) {
    note("critical", "status", path, `could not be fetched: ${String(error).slice(0, 120)}`);
    return null;
  }

  if (res.status !== 200) {
    note("critical", "status", path, `HTTP ${res.status}`);
    return null;
  }

  const title = one(html, /<title[^>]*>([^<]*)<\/title>/i);
  const h1s = many(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map((raw) => text(raw));
  const description = one(html, /<meta[^>]+name="description"[^>]+content="([^"]*)"/i);
  const canonical = one(html, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i);
  const robots = one(html, /<meta[^>]+name="robots"[^>]+content="([^"]*)"/i);
  const ogTitle = one(html, /<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i);
  const ogUrl = one(html, /<meta[^>]+property="og:url"[^>]+content="([^"]*)"/i);
  const ogDesc = one(html, /<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i);
  const hreflang = many(html, /rel="alternate"[^>]+href[Ll]ang="([^"]*)"/gi);
  const jsonLd = [...html.matchAll(/application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(
    (m) => m[1],
  );
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;
  const links = [...new Set(many(bodyHtml, /href="(\/[^"#?][^"]*)"/g).map(normalise))];
  const images = [...bodyHtml.matchAll(/<img\b([^>]*)>/gi)].map((m) => m[1]);
  const words = text(bodyHtml).split(/\s+/).filter(Boolean).length;

  // --- 1 indexability, 6 canonical -------------------------------------
  if (!canonical) note("critical", "canonical", path, "no canonical");
  else {
    if (!/^https:\/\//.test(canonical))
      note("critical", "canonical", path, `not absolute: ${canonical}`);
    else if (new URL(canonical).host !== new URL(SITE).host) {
      note("critical", "canonical", path, `foreign host: ${canonical}`);
    } else if (normalise(canonical) !== normalise(path)) {
      note("warning", "canonical", path, `points elsewhere: ${normalise(canonical)}`);
    }
  }
  if (expect.indexable && robots && /noindex/i.test(robots)) {
    note("critical", "indexability", path, `expected indexable, carries robots="${robots}"`);
  }
  if (!expect.indexable && !(robots && /noindex/i.test(robots))) {
    note("critical", "indexability", path, "expected noindex, carries none");
  }

  // --- 5 title / meta / H1 ---------------------------------------------
  if (!title) note("critical", "title", path, "no title");
  if (!h1s.length) note("critical", "h1", path, "no H1");
  if (h1s.length > 1) note("warning", "h1", path, `${h1s.length} H1 elements`);
  if (h1s.length === 1 && !h1s[0]) note("critical", "h1", path, "H1 is empty");
  if (expect.description && !description) note("critical", "meta", path, "no meta description");

  // --- 2 SSR visibility, 19 content quality ----------------------------
  if (words < expect.minWords) {
    note(
      expect.severity ?? "warning",
      "ssr-content",
      path,
      `${words} words of SSR text (expected at least ${expect.minWords})`,
    );
  }

  // --- 3 / 16 internal links -------------------------------------------
  if (links.length < expect.minLinks) {
    note(
      expect.severity ?? "warning",
      "internal-links",
      path,
      `${links.length} crawlable internal links (expected at least ${expect.minLinks})`,
    );
  }

  // --- 21 Open Graph ----------------------------------------------------
  if (expect.indexable) {
    if (!ogTitle) note("warning", "open-graph", path, "no og:title");
    if (!ogDesc) note("warning", "open-graph", path, "no og:description");
    if (ogUrl && normalise(ogUrl) !== normalise(path)) {
      note("warning", "open-graph", path, `og:url points at ${normalise(ogUrl)}`);
    }
  }

  // --- 26 hreflang ------------------------------------------------------
  if (expect.hreflang !== null) {
    if (hreflang.length !== expect.hreflang) {
      note(
        "critical",
        "hreflang",
        path,
        `${hreflang.length} alternates, expected ${expect.hreflang}`,
      );
    }
    const bad = hreflang.filter(
      (code) => code !== "x-default" && !/^[a-z]{2}(-[A-Z]{2})?$/.test(code),
    );
    if (bad.length)
      note("critical", "hreflang", path, `invalid codes: ${bad.slice(0, 4).join(", ")}`);
    if (hreflang.length !== new Set(hreflang).size) {
      note("critical", "hreflang", path, "duplicate hreflang codes");
    }
    if (expect.hreflang > 0 && !hreflang.includes("x-default")) {
      note("critical", "hreflang", path, "no x-default");
    }
  }

  // --- 9 structured data -------------------------------------------------
  for (const block of jsonLd) {
    let parsed;
    try {
      parsed = JSON.parse(block);
    } catch (error) {
      note("critical", "schema", path, `invalid JSON-LD: ${String(error).slice(0, 80)}`);
      continue;
    }
    const nodes = parsed["@graph"] ? parsed["@graph"] : [parsed];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      if (!node["@type"]) note("warning", "schema", path, "a node has no @type");
      for (const field of [
        "aggregateRating",
        "ratingValue",
        "reviewCount",
        "review",
        "offers",
        "price",
        "availability",
      ]) {
        if (field in node) {
          note(
            "critical",
            "schema",
            path,
            `${node["@type"]} claims "${field}" - needs verified data`,
          );
        }
      }
      for (const key of ["url", "item"]) {
        const value = node[key];
        if (typeof value === "string" && value && !/^https:\/\//.test(value)) {
          note("warning", "schema", path, `${key} is not an absolute https URL: ${value}`);
        }
      }
    }
  }

  // --- 22 image SEO ------------------------------------------------------
  const noAlt = images.filter((attrs) => !/\balt\s*=/.test(attrs)).length;
  if (noAlt)
    note("warning", "images", path, `${noAlt} of ${images.length} img elements have no alt`);

  // --- 15 URL quality ----------------------------------------------------
  if (path !== path.toLowerCase()) note("warning", "url", path, "URL is not lower-case");

  return {
    path,
    kind,
    title,
    h1: h1s[0] ?? null,
    description,
    canonical,
    robots,
    links,
    words,
    hreflang: hreflang.length,
    jsonLd: jsonLd.length,
  };
}

// ---------------------------------------------------------------- the sample
const pick = (rows, n) => {
  const step = Math.max(1, Math.floor(rows.length / n));
  const out = [];
  for (let i = 0; i < rows.length && out.length < n; i += step) out.push(rows[i]);
  return out;
};

console.log(`site        : ${SITE}`);
console.log(`per kind    : ${PER_KIND}`);

const slots = await rest(`marketplace_card_slots?select=slot_url&order=slot_url.asc&limit=8000`);
const products = await rest(
  `marketplace_products?select=slug&visible=eq.true&content_status=eq.published&order=id.asc&limit=1000`,
);
const categories = await rest(`marketplace_categories?select=slug&order=sort_order.asc&limit=200`);
const countries = await rest(
  `marketplace_card_slots?select=country_marker&order=slot_no.asc&limit=80`,
);
const countrySlug = (c) =>
  c
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const jobs = [];
for (const row of pick(slots, PER_KIND)) {
  jobs.push([
    row.slot_url,
    "slot",
    { indexable: true, description: true, minWords: 120, minLinks: 20, hreflang: 81 },
  ]);
}
for (const row of pick(products, PER_KIND)) {
  // The product page is client-rendered; that is a known, out-of-scope finding,
  // so its thresholds record what is there rather than pretending otherwise.
  jobs.push([
    `/marketplace/product/${row.slug}`,
    "product",
    {
      indexable: true,
      description: true,
      minWords: 120,
      minLinks: 3,
      hreflang: null,
      severity: "known",
    },
  ]);
}
for (const row of pick(categories, PER_KIND)) {
  jobs.push([
    `/marketplace/category/${row.slug}`,
    "category",
    { indexable: true, description: true, minWords: 100, minLinks: 20, hreflang: null },
  ]);
}
const seen = new Set();
for (const row of countries) {
  if (seen.has(row.country_marker)) continue;
  seen.add(row.country_marker);
}
for (const marker of pick([...seen], PER_KIND)) {
  jobs.push([
    `/marketplace/country/${countrySlug(marker)}`,
    "country",
    { indexable: true, description: true, minWords: 100, minLinks: 20, hreflang: null },
  ]);
}
jobs.push([
  "/",
  "hub",
  { indexable: true, description: true, minWords: 100, minLinks: 20, hreflang: null },
]);
jobs.push([
  "/marketplace",
  "hub",
  { indexable: true, description: true, minWords: 100, minLinks: 20, hreflang: null },
]);
jobs.push([
  "/blog",
  "blog-index",
  { indexable: false, description: true, minWords: 10, minLinks: 0, hreflang: null },
]);

console.log(`pages to test: ${jobs.length}`);

const measured = [];
const queue = [...jobs];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (;;) {
      const job = queue.shift();
      if (!job) return;
      const result = await measure(job[0], job[1], job[2]);
      if (result) measured.push(result);
    }
  }),
);

// ------------------------------------------- 5 uniqueness across the sample
const byTitle = new Map();
const byCanonical = new Map();
for (const page of measured) {
  if (page.title) {
    if (byTitle.has(page.title))
      note("warning", "duplicate-title", page.path, `same title as ${byTitle.get(page.title)}`);
    else byTitle.set(page.title, page.path);
  }
  if (page.canonical) {
    if (byCanonical.has(page.canonical))
      note(
        "critical",
        "duplicate-canonical",
        page.path,
        `same canonical as ${byCanonical.get(page.canonical)}`,
      );
    else byCanonical.set(page.canonical, page.path);
  }
}

// ------------------------------------------------- 28 broken internal links
const targets = [...new Set(measured.flatMap((page) => page.links))]
  .filter((href) => !href.startsWith("/api/") && !href.startsWith("/demo/"))
  .slice(0, 120);
let checked = 0;
const linkQueue = [...targets];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (;;) {
      const href = linkQueue.shift();
      if (!href) return;
      checked += 1;
      try {
        const res = await fetch(SITE + href, { redirect: "manual" });
        if (res.status >= 400) note("critical", "broken-link", href, `HTTP ${res.status}`);
        else if (res.status >= 300) {
          const to = res.headers.get("location") ?? "";
          note("warning", "redirect", href, `HTTP ${res.status} -> ${to}`);
        }
      } catch (error) {
        note("critical", "broken-link", href, String(error).slice(0, 80));
      }
    }
  }),
);

// ------------------------------------------------ 7 sitemap, 8 robots
const index = await (await fetch(`${SITE}/sitemap.xml`)).text();
const children = [...index.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
const sitemapUrls = [];
for (const child of children) {
  const xml = await (await fetch(child)).text();
  for (const loc of [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]))
    sitemapUrls.push(loc);
}
const uniqueSitemap = new Set(sitemapUrls.map(normalise));
if (uniqueSitemap.size !== sitemapUrls.length) {
  note(
    "critical",
    "sitemap",
    "/sitemap.xml",
    `${sitemapUrls.length} URLs but ${uniqueSitemap.size} distinct`,
  );
}
const notHttps = sitemapUrls.filter((u) => !u.startsWith("https://")).length;
if (notHttps)
  note("critical", "sitemap", "/sitemap.xml", `${notHttps} URLs are not absolute https`);

const robotsTxt = await (await fetch(`${SITE}/robots.txt`)).text();
if (!/sitemap:/i.test(robotsTxt))
  note("critical", "robots", "/robots.txt", "no Sitemap: reference");
for (const route of ["/marketplace", "/blog"]) {
  if (new RegExp(`disallow:\\s*${route}\\s*$`, "im").test(robotsTxt)) {
    note("critical", "robots", "/robots.txt", `${route} is disallowed`);
  }
}

// --------------------------------------------------------------- the report
console.log("");
console.log("== measured ==");
const kinds = [...new Set(measured.map((p) => p.kind))];
for (const kind of kinds) {
  const group = measured.filter((p) => p.kind === kind);
  const avg = (f) => Math.round(group.reduce((s, p) => s + f(p), 0) / group.length);
  console.log(
    `  ${kind.padEnd(12)} ${String(group.length).padStart(3)} pages | avg SSR words ${String(avg((p) => p.words)).padStart(5)}` +
      ` | avg links ${String(avg((p) => p.links.length)).padStart(4)}` +
      ` | with canonical ${group.filter((p) => p.canonical).length}/${group.length}` +
      ` | with H1 ${group.filter((p) => p.h1).length}/${group.length}` +
      ` | JSON-LD ${group.filter((p) => p.jsonLd).length}/${group.length}`,
  );
}
console.log("");
console.log(
  `sitemap URLs      : ${sitemapUrls.length} (${uniqueSitemap.size} distinct) across ${children.length} child sitemaps`,
);
console.log(`internal links checked: ${checked}`);
console.log("");
console.log("== findings ==");
const bySeverity = { critical: [], warning: [], known: [] };
for (const f of findings) (bySeverity[f.severity] ?? bySeverity.warning).push(f);
for (const level of ["critical", "warning", "known"]) {
  const list = bySeverity[level];
  console.log(`  ${level.toUpperCase()}: ${list.length}`);
  const byArea = {};
  for (const f of list) byArea[f.area] = (byArea[f.area] ?? 0) + 1;
  for (const [area, count] of Object.entries(byArea).sort((a, b) => b[1] - a[1])) {
    const sample = list.find((f) => f.area === area);
    console.log(
      `    ${String(count).padStart(4)}  ${area.padEnd(18)} e.g. ${sample.url} - ${sample.detail}`,
    );
  }
}
console.log("");
if (bySeverity.critical.length) {
  console.log(`RESULT: ${bySeverity.critical.length} critical finding(s). Not clean.`);
  process.exit(1);
}
console.log("RESULT: no critical findings against the acceptance criteria.");
