/**
 * Marketplace Manager figures against the database, read-only.
 *
 *   node scripts/ops/marketplace-manager-verify.mjs [base]
 *
 * Signs in as the Control Panel operator (credentials from .env.ops, never
 * printed), reads the Author and Vendor counters and "Verified" tabs through
 * /api/manager/resource exactly as the screen does, and compares each with a
 * count taken directly from sv_platform. Nothing is written.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) out[match[1]] = match[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return out;
}

const ops = readEnv(".env.ops");
const app = readEnv(".env");
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
const authUrl = ops.SUPABASE_URL ?? app.VITE_SUPABASE_URL;
const anon =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? app.VITE_SUPABASE_PUBLISHABLE_KEY ?? app.VITE_SUPABASE_ANON_KEY ?? ops.SUPABASE_ANON_KEY;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(76)} ${detail}`);
};

function count(sql) {
  const r = spawnSync("node", ["scripts/ops/db.mjs", "--sql", `set default_transaction_read_only = on; ${sql}`], { encoding: "utf8" });
  if (/\b(ERROR|FATAL):/.test(`${r.stdout}${r.stderr}`)) throw new Error(`${r.stderr}${r.stdout}`.slice(0, 400));
  const line = r.stdout.split("\n").map((l) => l.trim()).find((l) => /^\d+$/.test(l));
  return Number(line);
}

const session = await fetch(`${authUrl}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email: ops.SV_LOGIN_CONTROL_PANEL, password: ops.SV_PW_CONTROL_PANEL ?? ops.SV_PW_TEST }),
}).then((r) => r.json());
if (!session.access_token) {
  console.log("  FAIL  the Control Panel operator could not sign in");
  process.exit(1);
}
const headers = { Authorization: `Bearer ${session.access_token}` };

async function total(resource, filter) {
  const query = new URLSearchParams({ resource, limit: "1" });
  if (filter) query.append("filter", filter);
  const response = await fetch(`${BASE}/api/manager/resource?${query}`, { headers });
  const body = await response.json().catch(() => ({}));
  return response.ok ? body.total ?? (body.rows ?? []).length : `HTTP ${response.status}`;
}

const cases = [
  ["Authors", "authors", null, "select count(*) from marketplace_sellers"],
  ["Authors verified (approved sellers)", "authors", "status.eq.approved", "select count(*) from marketplace_sellers where status = 'approved'"],
  ["Vendors", "vendors", null, "select count(*) from marketplace_vendors"],
  ["Vendors verified", "vendors", "verified.eq.true", "select count(*) from marketplace_vendors where verified"],
  ["Licences active", "licences", "status.eq.active", "select count(*) from licenses where status = 'active'"],
];
for (const [label, resource, filter, sql] of cases) {
  const shown = await total(resource, filter);
  const truth = count(sql);
  check(`${label}: the manager shows what the database holds`, shown === truth, `shown ${shown}, database ${truth}`);
}

// A filter the resource does not expose is dropped, never passed to the database.
const dropped = await total("authors", "owner_user_id;drop.eq.x");
check("a filter on a column the resource does not expose is ignored", dropped === count("select count(*) from marketplace_sellers"), String(dropped));

console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
