/**
 * Every page of one kind, checked - not a sample of it.
 *
 * seo-acceptance.mjs samples a dozen or thirty of each kind, which is the right
 * shape for a broad sweep and the wrong shape for "are all of them sound". A
 * sample of twenty category pages found one failure where a sweep of all
 * ninety-one found three, and the two it missed were only reachable by asking
 * for every page in order.
 *
 * So this takes a sitemap and fetches every URL in it. The work is done a few
 * at a time rather than all at once, because the thing being measured is a
 * production site and hammering it would measure the hammering.
 *
 *   node scripts/ops/pages-verify.mjs products
 *   node scripts/ops/pages-verify.mjs slots --concurrency 8
 *   node scripts/ops/pages-verify.mjs countries https://softwarevala.net
 */

const args = process.argv.slice(2);
const KIND = args[0] ?? "products";
const SITE = (args.find((a) => a.startsWith("http")) ?? "https://softwarevala.net").replace(
  /\/+$/,
  "",
);
const CONCURRENCY =
  Number(args.includes("--concurrency") ? args[args.indexOf("--concurrency") + 1] : 8) || 8;
const SHOW = Number(args.includes("--show") ? args[args.indexOf("--show") + 1] : 25) || 25;

/** Which child sitemaps make up each kind. */
const SITEMAPS = {
  products: (n) => `/sitemap-products/${n}.xml`,
  slots: (n) => `/sitemap-slots/${n}.xml`,
  categories: () => "/sitemap-categories.xml",
  countries: () => "/sitemap-countries.xml",
  blog: () => "/sitemap-blog.xml",
  pages: () => "/sitemap-pages.xml",
};

if (!SITEMAPS[KIND]) {
  console.error(`unknown kind "${KIND}" - one of: ${Object.keys(SITEMAPS).join(", ")}`);
  process.exit(2);
}

const locs = (xml) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
const one = (html, re) => {
  const m = html.match(re);
  return m ? m[1].trim() : null;
};

async function text(url, timeoutMs = 60_000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  return { status: res.status, body: await res.text() };
}

// ------------------------------------------------------------- the inventory
const urls = [];
if (KIND === "products" || KIND === "slots") {
  for (let n = 1; ; n += 1) {
    const res = await fetch(`${SITE}${SITEMAPS[KIND](n)}`, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) break;
    const found = locs(await res.text());
    if (!found.length) break;
    urls.push(...found);
    if (found.length < 1000) break;
  }
} else {
  const res = await fetch(`${SITE}${SITEMAPS[KIND]()}`, { signal: AbortSignal.timeout(60_000) });
  urls.push(...locs(await res.text()));
}

console.log(`site        : ${SITE}`);
console.log(`kind        : ${KIND}`);
console.log(`inventory   : ${urls.length} pages`);
console.log(`concurrency : ${CONCURRENCY}`);
if (!urls.length) {
  console.log("\nRESULT: nothing advertised for this kind - nothing to check.");
  process.exit(0);
}

// ----------------------------------------------------------------- the check
const failures = [];
const titles = new Map();
const canonicals = new Map();
let done = 0;
let slowest = { url: "", ms: 0 };
const started = Date.now();

async function check(url) {
  const path = url.replace(SITE, "") || "/";
  const problems = [];
  const at = Date.now();
  let status = 0;
  let html = "";

  try {
    const got = await text(url);
    status = got.status;
    html = got.body;
  } catch (error) {
    problems.push(`did not answer: ${String(error).slice(0, 70)}`);
  }
  const ms = Date.now() - at;
  if (ms > slowest.ms) slowest = { url: path, ms };

  if (status && status !== 200) problems.push(`HTTP ${status}`);

  if (html) {
    const title = one(html, /<title[^>]*>([^<]*)<\/title>/i);
    const canonical = one(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    const h1 = one(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const robots = one(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);

    if (!title) problems.push("no title");
    if (!canonical) problems.push("no canonical");
    else {
      if (!canonical.startsWith("http")) problems.push(`canonical not absolute: ${canonical}`);
      else if (!canonical.startsWith(SITE)) problems.push(`canonical on a foreign host`);
      // A page advertised in a sitemap that points its canonical elsewhere is
      // asking to be dropped from the index it was just submitted to.
      else if (canonical.replace(/\/+$/, "") !== url.replace(/\/+$/, "")) {
        problems.push(`canonical points elsewhere: ${canonical}`);
      }
    }
    if (!h1) problems.push("no H1");
    // Advertised and noindex at once is the contradiction the gate exists to stop.
    if (robots && /noindex/i.test(robots)) problems.push(`advertised but robots="${robots}"`);

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
  }

  if (problems.length) failures.push(`${path} — ${problems.join("; ")}`);

  done += 1;
  if (done % 500 === 0) {
    const rate = done / ((Date.now() - started) / 1000);
    console.log(`  ... ${done}/${urls.length} (${rate.toFixed(0)}/s, ${failures.length} failing)`);
  }
}

// A fixed pool: the queue is shared, so a slow page delays itself and nothing else.
let next = 0;
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, urls.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= urls.length) return;
      await check(urls[i]);
    }
  }),
);

// ------------------------------------------------------------------ report
const passed = urls.length - failures.length;
const seconds = ((Date.now() - started) / 1000).toFixed(0);
console.log("");
console.log(`checked in     : ${seconds}s`);
console.log(`distinct titles: ${titles.size}/${passed || urls.length}`);
console.log(`slowest        : ${slowest.url} ${slowest.ms}ms`);
console.log("");

if (failures.length) {
  console.log(`RESULT: ${passed}/${urls.length} ${KIND} pages pass — ${failures.length} failing`);
  for (const line of failures.slice(0, SHOW)) console.log(`  ${line}`);
  if (failures.length > SHOW) console.log(`  ... and ${failures.length - SHOW} more`);
  process.exit(1);
}
console.log(`RESULT: ${passed}/${urls.length} ${KIND} pages pass.`);
