/**
 * Run SQL against the database the application actually reads.
 *
 * That database is PostgreSQL on the VPS — `sv_platform`, served to the app by
 * PostgREST behind the nginx gateway on 127.0.0.1:3010. It is not the hosted
 * Supabase project, and the difference is not cosmetic: this script used to
 * connect straight to `db.<ref>.supabase.co`, so a migration run through it
 * created its tables on a database the application never opens. The tables
 * existed, the script said "done", and production was unchanged.
 *
 * So the VPS is the default target and the hosted project has to be asked for
 * by name. The VPS database listens only on localhost, which is correct, so
 * this reaches it the same way an operator would: psql over the existing ssh
 * key. Nothing is exposed and no password crosses the network.
 *
 *   node scripts/ops/db.mjs --file supabase/migrations/xxxx.sql
 *   node scripts/ops/db.mjs --sql "select count(*) from marketplace_products"
 *   node scripts/ops/db.mjs --target hosted --sql "..."   # the Supabase project
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
const args = process.argv.slice(2);

const targetAt = args.indexOf("--target");
const target = targetAt >= 0 ? args[targetAt + 1] : "vps";
if (target !== "vps" && target !== "hosted") {
  console.error("--target takes either vps (the database the app reads) or hosted");
  process.exit(1);
}
const fileAt = args.indexOf("--file");
const sqlAt = args.indexOf("--sql");
const body =
  fileAt >= 0 ? readFileSync(args[fileAt + 1], "utf8") : sqlAt >= 0 ? args[sqlAt + 1] : null;
if (!body) {
  console.error("give either --file <path> or --sql <statement>");
  process.exit(1);
}

/**
 * The VPS route: psql on the server, over the ssh key the other ops scripts
 * use. The database listens on localhost only — which is how it should stay —
 * so this runs the statement where the database already is rather than opening
 * it to the network.
 */
if (target === "vps") {
  const host = ops.SV_SSH_HOST;
  const keyPath = (ops.SV_SSH_KEY ?? "").replace(
    /^~/,
    process.env.HOME ?? process.env.USERPROFILE ?? "~",
  );
  const database = ops.SV_DB_NAME ?? "sv_platform";
  if (!host || !keyPath) {
    console.error("SV_SSH_HOST and SV_SSH_KEY are needed in .env.ops to reach the VPS database");
    process.exit(1);
  }

  const scratch = mkdtempSync(join(tmpdir(), "sv-db-"));
  const local = join(scratch, "statement.sql");
  const remote = `/tmp/sv-db-${Date.now().toString(36)}.sql`;
  writeFileSync(local, body, "utf8");

  const ssh = ["-i", keyPath, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes"];
  try {
    console.log(`target  : VPS ${database} (the database the application reads)\n`);
    execFileSync("scp", [...ssh, local, `${host}:${remote}`], { stdio: "pipe" });
    const out = execFileSync(
      "ssh",
      [
        ...ssh,
        host,
        `sudo -u postgres psql -v ON_ERROR_STOP=1 -f ${remote} ${database}; rm -f ${remote}`,
      ],
      { encoding: "utf8" },
    );
    console.log(out.trimEnd() || "done — no rows returned");
  } catch (error) {
    const detail =
      `${error.stdout ?? ""}${error.stderr ?? ""}`.trim() || String(error.message ?? error);
    console.error("SQL failed:\n" + detail.slice(0, 1200));
    process.exitCode = 1;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  process.exit(process.exitCode ?? 0);
}

const ref = ops.SUPABASE_PROJECT_REF;
const password = ops.SUPABASE_DB_PASSWORD;
if (!ref || !password) {
  console.error("SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD are needed in .env.ops");
  process.exit(1);
}
console.log("target  : HOSTED Supabase — note the application does not read this database\n");

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
