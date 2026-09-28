/**
 * Influencer data parity: hosted Supabase -> VPS PostgreSQL.
 *
 * The influencer module is moving to the VPS as its single runtime source. The
 * two databases are copies of one another that diverged: the public application
 * form and the manager's applications queue were the last two paths still
 * talking to hosted, so rows written through them exist only there, while the
 * referral codes and commissions written by server routes exist only on the VPS.
 *
 * This reports the difference and, with --apply, copies the rows the VPS is
 * missing. It is deliberately one-directional and additive:
 *
 *   * it never deletes anything, on either side;
 *   * it never updates a row the VPS already has, so a row the owner has since
 *     changed on the VPS is left exactly as he changed it;
 *   * it copies by primary key, so re-running it does nothing the second time;
 *   * it goes in foreign-key order, and says plainly which rows would not go in
 *     rather than forcing them.
 *
 * Hosted is kept afterwards as an archive. Nothing there is removed by this.
 *
 *   node scripts/ops/influencer-vps-parity.mjs            report only
 *   node scripts/ops/influencer-vps-parity.mjs --apply    copy what is missing
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}

const HOSTED = (ops.SUPABASE_URL ?? "").replace(/\/+$/, "");
const KEY = ops.SUPABASE_SERVICE_ROLE_KEY ?? "";
const APPLY = process.argv.includes("--apply");

if (!HOSTED.includes("supabase.co")) {
  console.error("SUPABASE_URL in .env.ops is not the hosted project; nothing to compare against.");
  process.exit(1);
}

/**
 * Foreign-key order. A profile points at an application, an earning at a
 * campaign, a payout at a profile - so the order here is the order they can go
 * in, and reversing it would fail on the first row.
 */
const TABLES = [
  "influencer_applications",
  "influencer_profiles",
  "influencer_social_accounts",
  "influencer_campaign_assignments",
  "influencer_agreements",
  "influencer_activity",
  "influencer_earnings",
  "influencer_invoices",
  "influencer_payouts",
  "influencer_audit_logs",
  "influencer_notifications",
];

async function hostedRows(table) {
  const response = await fetch(`${HOSTED}/rest/v1/${table}?select=*&limit=10000`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!response.ok) return { ok: false, status: response.status, rows: [] };
  return { ok: true, status: 200, rows: await response.json() };
}

/** Ids the VPS already holds, asked of the VPS directly. */
function vpsIds(table) {
  const out = execFileSync(
    process.execPath,
    ["scripts/ops/db.mjs", "--sql", `select id::text from public.${table}`],
    { encoding: "utf8", timeout: 120_000 },
  );
  return new Set(
    out
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^[0-9a-f-]{36}$/i.test(l)),
  );
}

/**
 * The VPS's own column types for a table.
 *
 * Needed because PostgREST hands back a JavaScript array for both a jsonb
 * column and a text[] column, and the two are not interchangeable in SQL: a
 * first version of this wrote `'[]'::jsonb` into influencer_applications.
 * content_types, which is text[], and Postgres refused it. The destination
 * decides how a value is written, not the shape it arrived in.
 */
function columnTypes(table) {
  const out = execFileSync(
    process.execPath,
    [
      "scripts/ops/db.mjs",
      "--sql",
      `select column_name || '=' || data_type from information_schema.columns
        where table_schema='public' and table_name='${table}'`,
    ],
    { encoding: "utf8", timeout: 120_000 },
  );
  const types = {};
  for (const line of out.split("\n")) {
    const m = line.trim().match(/^([a-z0-9_]+)=(.+)$/i);
    if (m) types[m[1]] = m[2].trim();
  }
  return types;
}

const literal = (v, type) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";

  if (Array.isArray(v)) {
    if (type === "ARRAY") {
      // A Postgres array literal: {"a","b"}. Each element quoted, inner quotes
      // and backslashes escaped the way an array literal needs them.
      const inner = v
        .map((e) => `"${String(e).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
        .join(",");
      return `'{${inner}}'::text[]`;
    }
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

const work = mkdtempSync(join(tmpdir(), "sv-parity-"));
let statements = [];
const summary = [];

for (const table of TABLES) {
  const hosted = await hostedRows(table);
  if (!hosted.ok) {
    summary.push({ table, hosted: `unreadable (${hosted.status})`, vps: "-", missing: "-" });
    continue;
  }
  const have = vpsIds(table);
  const missing = hosted.rows.filter((r) => r.id && !have.has(String(r.id)));
  summary.push({ table, hosted: hosted.rows.length, vps: have.size, missing: missing.length });

  if (missing.length) {
    const types = columnTypes(table);
    for (const row of missing) {
      const columns = Object.keys(row).filter((c) => types[c]);
      statements.push(
        `insert into public.${table} (${columns.map((c) => `"${c}"`).join(", ")}) values (${columns
          .map((c) => literal(row[c], types[c]))
          .join(", ")}) on conflict (id) do nothing;`,
      );
    }
  }
}

console.log("\n  table                            hosted   vps   missing on the VPS");
for (const s of summary) {
  console.log(
    `  ${String(s.table).padEnd(32)} ${String(s.hosted).padStart(6)} ${String(s.vps).padStart(5)} ${String(s.missing).padStart(9)}`,
  );
}

if (statements.length === 0) {
  console.log("\n  The VPS holds every influencer row hosted holds. Parity is complete.");
  process.exit(0);
}

console.log(`\n  ${statements.length} row(s) the VPS does not have.`);

if (!APPLY) {
  console.log("  Re-run with --apply to copy them. Nothing has been changed.");
  process.exit(0);
}

// Each row on its own, so one that cannot go in does not take the rest with it.
const file = join(work, "parity.sql");
writeFileSync(file, statements.join("\n"), "utf8");
console.log(`\n  applying ${statements.length} insert(s)...`);
try {
  const out = execFileSync(process.execPath, ["scripts/ops/db.mjs", "--file", file], {
    encoding: "utf8",
    timeout: 300_000,
  });
  console.log(out.split("\n").filter((l) => l.includes("INSERT") || l.includes("ERROR")).join("\n"));
  // psql keeps going after a failed statement and db.mjs still exits 0, so a
  // silent partial copy is possible unless the output itself is checked.
  if (out.includes("ERROR")) {
    console.error("\n  At least one row did not go in. Parity is NOT complete - see the errors above.");
    process.exit(1);
  }
} catch (error) {
  console.error("  some rows did not go in:\n", String(error.stdout ?? error.message).slice(0, 2000));
  process.exit(1);
}
console.log("\n  Done. Nothing was deleted and nothing already on the VPS was changed.");
