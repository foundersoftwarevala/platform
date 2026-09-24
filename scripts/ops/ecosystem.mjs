/**
 * The whole platform, table by table.
 *
 * Counts every row the database holds and asks, for each table, whether any
 * screen in this codebase ever reads it - through a Supabase call, a manager
 * resource, a server function or an RPC. Four answers matter:
 *
 *   HELD, UNREAD   data nobody can see. Work already done, invisible.
 *   READ, EMPTY    a screen waiting for rows that have never arrived.
 *   LIVE           rows, and something that shows them.
 *   UNUSED         neither rows nor a reader.
 *
 * It writes nothing and changes nothing.
 *
 *   node scripts/ops/ecosystem.mjs [--all]
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return out;
}

const ops = readEnv(".env.ops");
const base = ops.SUPABASE_URL;
const key = ops.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const showAll = process.argv.includes("--all");

// ---------------------------------------------------------------- the schema
const spec = await fetch(`${base}/rest/v1/`, { headers }).then((r) => r.json());
const tables = Object.keys(spec.definitions ?? {}).filter((t) => !t.startsWith("rpc/"));

// ------------------------------------------------------------- what the code reads
const source = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry)) source.push(full);
  }
})("src");

let code = "";
for (const file of source) {
  try { code += readFileSync(file, "utf8"); } catch { /* unreadable */ }
}

/** Does anything in the codebase name this table? */
function isRead(table) {
  return (
    code.includes(`from("${table}")`) ||
    code.includes(`from('${table}')`) ||
    code.includes(`table: "${table}"`) ||
    code.includes(`"${table}"`) && new RegExp(`(from|table|rpc)\\s*[:(]\\s*["']${table}["']`).test(code)
  );
}

// -------------------------------------------------------------- how many rows
async function count(table) {
  try {
    const res = await fetch(`${base}/rest/v1/${table}?select=*`, {
      headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
    });
    const range = res.headers.get("content-range") ?? "";
    const total = range.split("/")[1];
    return total === "*" || total === undefined ? null : Number(total);
  } catch {
    return null;
  }
}

const rows = [];
const lanes = 8;
let cursor = 0;
await Promise.all(
  Array.from({ length: lanes }, async () => {
    while (cursor < tables.length) {
      const table = tables[cursor++];
      const n = await count(table);
      const read = isRead(table);
      rows.push({
        table,
        rows: n,
        read,
        state:
          n === null ? "UNREADABLE"
          : n > 0 && read ? "LIVE"
          : n > 0 && !read ? "HELD, UNREAD"
          : n === 0 && read ? "READ, EMPTY"
          : "UNUSED",
      });
    }
  }),
);

rows.sort((a, b) => (b.rows ?? 0) - (a.rows ?? 0));
const by = (s) => rows.filter((r) => r.state === s);

console.log(`${tables.length} tables in the database\n`);
for (const s of ["LIVE", "HELD, UNREAD", "READ, EMPTY", "UNUSED", "UNREADABLE"]) {
  console.log(`  ${s.padEnd(14)} ${String(by(s).length).padStart(4)}`);
}

const orphanRows = by("HELD, UNREAD").filter((r) => (r.rows ?? 0) > 0);
console.log(`\ndata nobody can see — ${orphanRows.length} tables, ${orphanRows.reduce((s, r) => s + (r.rows ?? 0), 0)} rows:`);
for (const r of orphanRows.slice(0, showAll ? 999 : 30)) {
  console.log(`  ${String(r.rows).padStart(6)}  ${r.table}`);
}

const biggestLive = by("LIVE").slice(0, 15);
console.log(`\nthe platform's largest live tables:`);
for (const r of biggestLive) console.log(`  ${String(r.rows).padStart(6)}  ${r.table}`);

writeFileSync("ecosystem.json", JSON.stringify({ generated_at: new Date().toISOString(), rows }, null, 2));
console.log(`\nfull table written to ecosystem.json`);
