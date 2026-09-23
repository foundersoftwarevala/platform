/**
 * Run SQL against the project's database.
 *
 * The Management API refuses the keys this machine has, and there is no psql
 * on the server, so a migration had no way to be applied at all. This connects
 * with the database password from .env.ops - which never leaves this machine
 * and is never printed - and runs a file, or a statement given on the command
 * line.
 *
 *   node scripts/ops/db.mjs --file supabase/migrations/xxxx.sql
 *   node scripts/ops/db.mjs --sql "select count(*) from marketplace_products"
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return out;
}

const ops = readEnv(".env.ops");
const ref = ops.SUPABASE_PROJECT_REF;
const password = ops.SUPABASE_DB_PASSWORD;
if (!ref || !password) {
  console.error("SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD are needed in .env.ops");
  process.exit(1);
}

const args = process.argv.slice(2);
const fileAt = args.indexOf("--file");
const sqlAt = args.indexOf("--sql");
const body =
  fileAt >= 0 ? readFileSync(args[fileAt + 1], "utf8")
  : sqlAt >= 0 ? args[sqlAt + 1]
  : null;
if (!body) {
  console.error("give either --file <path> or --sql <statement>");
  process.exit(1);
}

// Supabase serves the same database on a direct host and through poolers in
// each region; whichever answers first is the one used.
const hosts = [
  { host: `db.${ref}.supabase.co`, port: 5432, user: "postgres" },
  ...["ap-south-1", "us-east-1", "ap-southeast-1", "eu-central-1", "us-west-1"].map((region) => ({
    host: `aws-0-${region}.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${ref}`,
  })),
];

let sql = null;
for (const candidate of hosts) {
  try {
    const attempt = postgres({
      ...candidate,
      database: "postgres",
      password,
      ssl: "require",
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15,
      onnotice: () => {},
    });
    await attempt`select 1`;
    sql = attempt;
    console.log(`connected via ${candidate.host}\n`);
    break;
  } catch (error) {
    console.log(`  ${candidate.host} — ${String(error.message ?? error).slice(0, 70)}`);
  }
}
if (!sql) {
  console.error("\nno route to the database answered");
  process.exit(1);
}

try {
  const result = await sql.unsafe(body);
  const rows = Array.isArray(result) ? result : [];
  if (rows.length) {
    console.log(`${rows.length} row(s):`);
    for (const row of rows.slice(0, 40)) console.log("  " + JSON.stringify(row));
  } else {
    console.log("done — no rows returned");
  }
} catch (error) {
  console.error("SQL failed:", String(error.message ?? error).slice(0, 400));
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
