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

    const line = text.slice(0, m.index).split("\n").length;
    found.push({ file: file.replace(/\\/g, "/"), line, table });
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

console.log(`${found.length} unbounded select(s) across ${ordered.length} table(s)\n`);
for (const [table, rows] of ordered) {
  console.log(`${table}  (${rows.length})`);
  for (const r of rows) console.log(`    ${r.file}:${r.line}`);
}

console.log(
  "\nEach of these returns at most 10,000 rows and reports no truncation. " +
    "Page it, or count it in SQL.",
);
