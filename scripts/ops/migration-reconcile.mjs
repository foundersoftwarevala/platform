/**
 * Migration files against the production schema (read-only).
 *
 *   node scripts/ops/migration-reconcile.mjs > migration-reconcile.md
 *
 * For every file in supabase/migrations: is its version recorded in
 * supabase_migrations.schema_migrations, and do the tables, views, functions
 * and indexes it creates exist in sv_platform today? A file whose objects all
 * exist has its effect applied whether or not it was recorded (most were
 * applied with scripts/ops/db.mjs, which does not record versions). A file
 * that creates something production lacks is listed with the missing names.
 */
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function sql(q) {
  const r = spawnSync("node", ["scripts/ops/db.mjs", "--sql", `set default_transaction_read_only = on; ${q}`], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  if (/\b(ERROR|FATAL):/.test(`${r.stdout}${r.stderr}`)) throw new Error(`${r.stderr}${r.stdout}`.slice(0, 500));
  return r.stdout.split("\n").map((l) => l.trim()).filter((l) => l && !/^target|^SET$|^-+$|rows?\)$/.test(l));
}

const recorded = new Set(sql("select version from supabase_migrations.schema_migrations").slice(1));
const relations = new Set(sql("select relname from pg_class where relnamespace='public'::regnamespace").slice(1));
const functions = new Set(sql("select proname from pg_proc where pronamespace='public'::regnamespace").slice(1));
const triggers = new Set(sql("select tgname from pg_trigger where not tgisinternal").slice(1));

const created = (text) => {
  const strip = text.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const names = (re) => [...strip.matchAll(re)].map((m) => m[1].toLowerCase());
  return {
    tables: names(/create\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi),
    views: names(/create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi),
    functions: names(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi),
    indexes: names(/create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?\s+on\s+(?:public\.)?/gi),
    triggers: names(/create\s+(?:or\s+replace\s+)?trigger\s+"?([a-z_][a-z0-9_]*)"?/gi),
    dropsTables: names(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi),
  };
};

const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
const defined = new Map(); // table -> files creating it
const rows = [];
for (const file of files) {
  const version = file.split("_")[0];
  const text = readFileSync(`supabase/migrations/${file}`, "utf8");
  const c = created(text);
  for (const t of c.tables) defined.set(t, [...(defined.get(t) ?? []), file]);
  const dropped = new Set(c.dropsTables);
  const missing = [
    ...c.tables.filter((t) => !relations.has(t) && !dropped.has(t)).map((t) => `table ${t}`),
    ...c.views.filter((t) => !relations.has(t)).map((t) => `view ${t}`),
    ...c.functions.filter((t) => !functions.has(t)).map((t) => `function ${t}`),
    ...c.indexes.filter((t) => !relations.has(t)).map((t) => `index ${t}`),
    ...c.triggers.filter((t) => !triggers.has(t)).map((t) => `trigger ${t}`),
  ];
  const objects = c.tables.length + c.views.length + c.functions.length + c.indexes.length + c.triggers.length;
  const rerunSafe = !/create\s+table\s+(?!if\s+not\s+exists)/i.test(text.replace(/--[^\n]*/g, "")) || /if\s+not\s+exists|drop\s+table\s+if\s+exists/i.test(text);
  rows.push({ file, recorded: recorded.has(version), objects, missing, rerunSafe });
}

const applied = rows.filter((r) => r.missing.length === 0);
const partial = rows.filter((r) => r.missing.length > 0);
console.log(`# Migration reconciliation\n`);
console.log(`- files: ${rows.length}; versions recorded in schema_migrations: ${recorded.size}; files whose version is recorded: ${rows.filter((r) => r.recorded).length}`);
console.log(`- files whose created objects all exist in production: ${applied.length} (of which unrecorded: ${applied.filter((r) => !r.recorded).length})`);
console.log(`- files with objects missing from production: ${partial.length}`);
console.log(`- files with a plain CREATE TABLE (not re-runnable as written): ${rows.filter((r) => !r.rerunSafe).length}`);
const dup = [...defined.entries()].filter(([, f]) => f.length > 1);
console.log(`- tables created by more than one file: ${dup.length}\n`);
console.log(`## Files with objects missing from production\n`);
for (const r of partial) console.log(`- ${r.file} (recorded: ${r.recorded}) — ${r.missing.join(", ")}`);
console.log(`\n## Tables defined by more than one file\n`);
for (const [t, f] of dup) console.log(`- ${t}: ${f.join(", ")}`);
console.log(`\n## Every file\n\n| file | recorded | objects | missing | re-runnable |\n|---|---|---|---|---|`);
for (const r of rows) console.log(`| ${r.file} | ${r.recorded ? "yes" : "no"} | ${r.objects} | ${r.missing.length} | ${r.rerunSafe ? "yes" : "no"} |`);
