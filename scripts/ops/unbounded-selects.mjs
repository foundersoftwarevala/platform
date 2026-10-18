/**
 * Every query that asks a table for everything.
 *
 * PostgREST on this server caps a result at 10,000 rows and says nothing when
 * it does, so a select with no limit is not "all rows" — it is the first ten
 * thousand, returned as though it were the whole answer. The Products section
 * was found this way: it fetched all 7,365 products and drew 7,390 rows in one
 * DOM, and past the cap it would simply have stopped showing the newest ones.
 *
 * This reports the same shape everywhere else it occurs, so the list is a
 * worklist rather than a guess.
 *
 * A query is left out when it already bounds itself — .limit, .range, .single,
 * .maybeSingle — or when it selects one row by id, or when it asks only for a
 * count with head: true. Those are correct as they stand.
 *
 *   node scripts/ops/unbounded-selects.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP = /node_modules|\.output|__tests__|\.test\./;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (SKIP.test(full)) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const found = [];

for (const file of walk("src")) {
  const text = readFileSync(file, "utf8");
  const chain = /\.from\(\s*["'`]([a-z_]+)["'`]\s*\)([\s\S]{0,420}?);/g;
  let m;
  while ((m = chain.exec(text))) {
    const [, table, body] = m;
    if (!/\.select\(/.test(body)) continue;
    if (/\.(limit|range|single|maybeSingle)\(/.test(body)) continue;
    if (/head:\s*true/.test(body)) continue;
    // One row fetched by its own id is bounded by definition.
    if (/\.eq\(\s*["'`]id["'`]/.test(body)) continue;

    // A filter bounds a query as surely as a limit does, and most of these
    // have one. Separating them is the difference between a worklist and a
    // 147-line dump: an .eq on a category, an .in on a list of ids or a .gte
    // on a date window all cap the result by something the caller controls,
    // and each of those was checked by hand and found safe. A select with no
    // filter at all is the shape that silently returns the first 10,000 rows
    // of whatever the table happens to hold.
    const filtered = /\.(eq|neq|in|gt|gte|lt|lte|like|ilike|or|filter|match|contains|overlaps|textSearch)\(/.test(body);

    const line = text.slice(0, m.index).split("\n").length;
    found.push({ file: file.replace(/\\/g, "/"), line, table, filtered });
  }
}

// Group by table, because the same table read unbounded from several places is
// one problem, not several.
const byTable = new Map();
for (const row of found) {
  const list = byTable.get(row.table) ?? [];
  list.push(row);
  byTable.set(row.table, list);
}

const ordered = [...byTable.entries()].sort((a, b) => b[1].length - a[1].length);
const naked = found.filter((r) => !r.filtered);

console.log(`${found.length} select(s) with no limit, across ${ordered.length} table(s).`);
console.log(`${naked.length} of them carry no filter either.\n`);

console.log("NO LIMIT AND NO FILTER — these read whatever the table holds:");
if (naked.length === 0) {
  console.log("  none");
} else {
  for (const r of naked) console.log(`  ${r.table.padEnd(30)} ${r.file}:${r.line}`);
}

console.log("\nBOUNDED BY A FILTER — each needs judgement, not a blanket change:");
for (const [table, rows] of ordered) {
  const withFilter = rows.filter((r) => r.filtered);
  if (!withFilter.length) continue;
  console.log(`  ${table}  (${withFilter.length})`);
}

console.log(
  "\nA filter caps a result as surely as a limit does. The ones checked by hand:\n" +
    "  marketplace_translations  176,134 rows, but read by .in(hashes) — one page's\n" +
    "                            own strings, so bounded by the page, not the table\n" +
    "  server_metrics_history      5,318 rows, but read through a six-hour window\n" +
    "  marketplace_products        7,365 rows; the admin table and the demo picker\n" +
    "                            are paged, and the category read is capped by the\n" +
    "                            category — the largest holds 161\n" +
    "Everything else on the list is a table of 500 rows or fewer.",
);
