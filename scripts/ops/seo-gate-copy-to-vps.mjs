import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import postgres from "postgres";

const BATCH_SIZE = 1000;
const TABLES = [
  {
    name: "seo_indexing_decisions",
    order: "url.asc",
    key: (row) => row.url,
    conflict: "(url)",
    columns: `id uuid primary key default gen_random_uuid(),
      url text not null,
      entity_type text not null,
      entity_id uuid,
      state text not null default 'UNVERIFIED',
      indexable boolean not null default false,
      sitemap_eligible boolean not null default false,
      quality_status text not null default 'UNVERIFIED',
      quality_score integer,
      fingerprint_class text not null default 'UNVERIFIED',
      canonical_status text not null default 'UNVERIFIED',
      schema_status text not null default 'UNVERIFIED',
      hreflang_status text not null default 'UNVERIFIED',
      content_status text not null default 'UNVERIFIED',
      http_status integer,
      blocking_reason text,
      checks jsonb not null default '[]'::jsonb,
      duplicate_of text,
      audit_version text not null default 'v1',
      evaluated_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint seo_indexing_decisions_state_known check (state in (
        'READY_FOR_INDEX', 'INDEX', 'NOINDEX', 'CONTENT_NOT_READY',
        'DRAFT', 'TEST', 'ARCHIVED', 'BLOCKED', 'UNVERIFIED', 'ERROR'
      )),
      constraint seo_indexing_decisions_only_ready_indexes check (
        indexable = false or state in ('READY_FOR_INDEX', 'INDEX')
      ),
      constraint seo_indexing_decisions_sitemap_follows_index check (
        sitemap_eligible = false or indexable = true
      ),
      constraint seo_indexing_decisions_one_per_url unique (url)`,
    indexes: [
      `create index if not exists seo_indexing_decisions_sitemap_idx
        on public.seo_indexing_decisions (sitemap_eligible) where sitemap_eligible`,
      `create index if not exists seo_indexing_decisions_state_idx
        on public.seo_indexing_decisions (state)`,
      `create index if not exists seo_indexing_decisions_entity_idx
        on public.seo_indexing_decisions (entity_type, entity_id)`,
      `create index if not exists seo_indexing_decisions_evaluated_idx
        on public.seo_indexing_decisions (evaluated_at desc)`,
      `create index if not exists seo_indexing_decisions_sitemap_url_idx
        on public.seo_indexing_decisions (url) where sitemap_eligible`,
    ],
  },
  {
    name: "seo_fingerprints",
    order: "url.asc,layer.asc",
    key: (row) => `${row.url}\u0000${row.layer}`,
    conflict: "(url, layer)",
    columns: `id uuid primary key default gen_random_uuid(),
      url text not null,
      entity_type text not null,
      entity_id uuid,
      layer text not null,
      algorithm text not null default 'sha256+simhash64',
      hash text not null,
      simhash text,
      token_count integer not null default 0,
      sample text,
      audit_version text not null default 'v1',
      computed_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint seo_fingerprints_layer_known check (layer in (
        'url', 'title', 'h1', 'description', 'intro', 'h2_structure',
        'faq', 'features', 'entities', 'body', 'body_masked'
      )),
      constraint seo_fingerprints_one_per_layer unique (url, layer)`,
    indexes: [
      `create index if not exists seo_fingerprints_hash_idx
        on public.seo_fingerprints (hash)`,
      `create index if not exists seo_fingerprints_layer_hash_idx
        on public.seo_fingerprints (layer, hash)`,
      `create index if not exists seo_fingerprints_simhash_idx
        on public.seo_fingerprints (simhash)`,
      `create index if not exists seo_fingerprints_entity_idx
        on public.seo_fingerprints (entity_type, entity_id)`,
      `create index if not exists seo_fingerprints_url_idx
        on public.seo_fingerprints (url)`,
    ],
  },
];

function readSettings(directory) {
  const path = resolve(directory, ".env");
  if (!existsSync(path)) return {};
  const values = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const at = line.indexOf("=");
    if (at <= 0 || line.trimStart().startsWith("#")) continue;
    const key = line.slice(0, at).trim();
    const value = line
      .slice(at + 1)
      .trim()
      .replace(/^(["'])([\s\S]*)\1$/, "$2");
    values[key] = value;
  }
  return values;
}

function setting(name, fileSettings) {
  return (process.env[name] || fileSettings[name] || "").trim();
}

function canonicalize(value, key = "") {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && /_at$/.test(key)) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((childKey) => [childKey, canonicalize(value[childKey], childKey)]),
    );
  }
  return value;
}

export function rowHash(row) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(row)))
    .digest("hex");
}

export function classifyRows(rows, existing, spec) {
  const missing = [];
  let conflicts = 0;
  const conflictFields = {};
  const timestampDirection = { sourceNewer: 0, targetNewer: 0, same: 0 };
  for (const row of rows) {
    const key = spec.key(row);
    const existingRow = existing.get(key);
    if (existingRow === undefined) {
      missing.push(row);
      continue;
    }
    const existingHash = typeof existingRow === "string" ? existingRow : rowHash(existingRow);
    if (existingHash === rowHash(row)) continue;

    conflicts++;
    if (typeof existingRow === "string") continue;
    const sourceValues = canonicalize(row);
    const targetValues = canonicalize(existingRow);
    for (const field of Object.keys(sourceValues)) {
      if (JSON.stringify(sourceValues[field]) !== JSON.stringify(targetValues[field]))
        conflictFields[field] = (conflictFields[field] || 0) + 1;
    }
    const timestampField = ["updated_at", "evaluated_at", "computed_at"].find(
      (field) => row[field] && existingRow[field],
    );
    if (timestampField) {
      const sourceTime = Date.parse(row[timestampField]);
      const targetTime = Date.parse(existingRow[timestampField]);
      if (sourceTime > targetTime) timestampDirection.sourceNewer++;
      else if (targetTime > sourceTime) timestampDirection.targetNewer++;
      else timestampDirection.same++;
    }
  }
  return { missing, conflicts, conflictFields, timestampDirection };
}

function restHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

function restUrl(base, table, query) {
  return `${base.replace(/\/+$/, "")}/rest/v1/${table}?${query}`;
}

async function sourceCount(base, key, table) {
  const response = await fetch(restUrl(base, table, "select=url"), {
    headers: { ...restHeaders(key), Range: "0-0", Prefer: "count=exact" },
  });
  if (!response.ok) throw new Error(`${table} count failed with HTTP ${response.status}`);
  const contentRange = response.headers.get("content-range");
  const match = contentRange?.match(/\/(\d+)$/);
  if (!match) throw new Error(`${table} count response did not include an exact total`);
  return Number(match[1]);
}

async function* sourcePages(base, key, spec) {
  const query = new URLSearchParams({ select: "*", order: spec.order }).toString();
  for (let from = 0; ; from += BATCH_SIZE) {
    const response = await fetch(restUrl(base, spec.name, query), {
      headers: {
        ...restHeaders(key),
        Range: `${from}-${from + BATCH_SIZE - 1}`,
      },
    });
    if (!response.ok)
      throw new Error(`${spec.name} page ${from} failed with HTTP ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error(`${spec.name} page was not a row array`);
    if (rows.length) yield rows;
    if (rows.length < BATCH_SIZE) return;
  }
}

async function ensureSchema(db) {
  for (const spec of TABLES) {
    await db.unsafe(`create table if not exists public.${spec.name} (${spec.columns})`);
    for (const index of spec.indexes) await db.unsafe(index);
  }

  const triggerFunction = await db`
    select to_regprocedure('public.update_updated_at_column()') is not null as exists`;
  if (!triggerFunction[0].exists) {
    await db.unsafe(`
      create function public.update_updated_at_column()
      returns trigger language plpgsql as $$
      begin
        new.updated_at = now();
        return new;
      end;
      $$`);
  }
  for (const spec of TABLES) {
    await db.unsafe(`drop trigger if exists trg_${spec.name}_updated on public.${spec.name}`);
    await db.unsafe(
      `create trigger trg_${spec.name}_updated before update on public.${spec.name}
       for each row execute function public.update_updated_at_column()`,
    );
    await db.unsafe(`alter table public.${spec.name} enable row level security`);
  }
  await db.unsafe(`
    do $$
    begin
      if not exists (
        select 1 from pg_policies
         where schemaname = 'public' and tablename = 'seo_fingerprints'
           and policyname = 'seo_fingerprints_service_role'
      ) then
        create policy seo_fingerprints_service_role on public.seo_fingerprints
          for all to service_role using (true) with check (true);
      end if;
      if not exists (
        select 1 from pg_policies
         where schemaname = 'public' and tablename = 'seo_indexing_decisions'
           and policyname = 'seo_indexing_decisions_service_role'
      ) then
        create policy seo_indexing_decisions_service_role on public.seo_indexing_decisions
          for all to service_role using (true) with check (true);
      end if;
    end
    $$`);
}

async function verifyColumns(db, base, key, spec) {
  const response = await fetch(
    restUrl(base, spec.name, new URLSearchParams({ select: "*", limit: "1" }).toString()),
    { headers: restHeaders(key) },
  );
  if (!response.ok)
    throw new Error(`${spec.name} schema probe failed with HTTP ${response.status}`);
  const sourceRows = await response.json();
  if (!Array.isArray(sourceRows) || !sourceRows.length)
    throw new Error(`${spec.name} is empty on Supabase; schema cannot be verified from rows`);
  const sourceColumns = Object.keys(sourceRows[0]).sort();
  const targetRows = await db`
    select column_name
      from information_schema.columns
     where table_schema = 'public' and table_name = ${spec.name}
     order by ordinal_position`;
  const targetColumns = targetRows.map((row) => row.column_name).sort();
  if (targetColumns.join("\0") !== sourceColumns.join("\0"))
    throw new Error(`${spec.name} VPS and Supabase columns differ`);
  return sourceColumns;
}

async function countTarget(db, table) {
  const rows = await db.unsafe(`select count(*)::bigint as count from public.${table}`);
  return Number(rows[0].count);
}

async function readTargetRows(db, spec) {
  const rows = await db.unsafe(`select * from public.${spec.name}`);
  return new Map(rows.map((row) => [spec.key(row), row]));
}

async function scanSource(base, key, spec, targetHashes, expectedCount) {
  let seen = 0;
  let missing = 0;
  let conflicts = 0;
  const conflictSignature = createHash("sha256");
  const conflictFields = {};
  const missingLayers = {};
  const missingTimes = [];
  const timestampDirection = { sourceNewer: 0, targetNewer: 0, same: 0 };
  for await (const rows of sourcePages(base, key, spec)) {
    seen += rows.length;
    const classified = classifyRows(rows, targetHashes, spec);
    missing += classified.missing.length;
    conflicts += classified.conflicts;
    for (const row of classified.missing) {
      if (row.layer) missingLayers[row.layer] = (missingLayers[row.layer] || 0) + 1;
      const timestamp = row.computed_at || row.evaluated_at || row.updated_at;
      const parsed = Date.parse(timestamp);
      if (Number.isFinite(parsed)) missingTimes.push(parsed);
    }
    for (const row of rows) {
      const targetRow = targetHashes.get(spec.key(row));
      if (targetRow !== undefined && rowHash(row) !== rowHash(targetRow)) {
        conflictSignature.update(spec.key(row));
        conflictSignature.update("\0");
        conflictSignature.update(rowHash(row));
        conflictSignature.update(rowHash(targetRow));
        conflictSignature.update("\n");
      }
    }
    for (const [field, count] of Object.entries(classified.conflictFields))
      conflictFields[field] = (conflictFields[field] || 0) + count;
    for (const direction of Object.keys(timestampDirection))
      timestampDirection[direction] += classified.timestampDirection[direction];
  }
  if (seen !== expectedCount)
    throw new Error(`${spec.name} changed during scan (expected ${expectedCount}, read ${seen})`);
  return {
    seen,
    missing,
    conflicts,
    conflictFields,
    missingLayers,
    missingTimeRange:
      missingTimes.length > 0
        ? {
            oldest: new Date(Math.min(...missingTimes)).toISOString(),
            newest: new Date(Math.max(...missingTimes)).toISOString(),
          }
        : null,
    timestampDirection,
    conflictSignature: conflictSignature.digest("hex"),
  };
}

function databaseBackupEnvironment(connectionString) {
  const url = new URL(connectionString);
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: url.searchParams.get("sslmode") || "prefer",
  };
}

async function checksumFile(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function backupGate(connectionString) {
  const root = "/root/sv-seo-backup";
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
  const directory = resolve(root, `seo-copy-${timestamp}`);
  mkdirSync(directory, { recursive: false, mode: 0o700 });
  const dump = resolve(directory, "gate.dump");
  const env = databaseBackupEnvironment(connectionString);
  execFileSync(
    "pg_dump",
    [
      "--format=custom",
      "--table=public.seo_indexing_decisions",
      "--table=public.seo_fingerprints",
      "--file",
      dump,
    ],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  const listing = execFileSync("pg_restore", ["--list", dump], { encoding: "utf8" });
  for (const table of ["seo_indexing_decisions", "seo_fingerprints"])
    if (!listing.includes(`TABLE DATA public ${table} `))
      throw new Error(`Verified backup is missing ${table} data`);
  execFileSync("pg_restore", ["--file", "/dev/null", dump], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const checksum = await checksumFile(dump);
  writeFileSync(resolve(directory, "SHA256SUMS"), `${checksum}  gate.dump\n`, {
    mode: 0o600,
  });
  writeFileSync(
    resolve(directory, "restore.sh"),
    [
      "#!/bin/sh",
      "set -eu",
      'cd "$(dirname "$0")"',
      "sha256sum -c SHA256SUMS",
      'test "${PGDATABASE:-}" = "sv_platform"',
      'sudo -u postgres pg_restore --dbname "$PGDATABASE" --clean --if-exists --single-transaction --exit-on-error < gate.dump',
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  return { directory, checksum };
}

async function insertMissing(db, spec, rows) {
  if (!rows.length) return 0;
  const query = `insert into public.${spec.name}
    select * from json_populate_recordset(null::public.${spec.name}, $1::text::json)
    on conflict ${spec.conflict} do nothing`;
  await db.unsafe(query, [JSON.stringify(rows)]);
  return rows.length;
}

export async function runCopy({
  apply = false,
  directory = process.env.DEPLOY_REPO_DIR || process.cwd(),
} = {}) {
  const fileSettings = readSettings(directory);
  const supabaseUrl = setting("SUPABASE_URL", fileSettings).replace(/\/+$/, "");
  const serviceKey = setting("SUPABASE_SERVICE_ROLE_KEY", fileSettings);
  const databaseUrl = setting("VPS_DATABASE_URL", fileSettings);
  if (!supabaseUrl || !serviceKey || !databaseUrl)
    throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and VPS_DATABASE_URL are required");

  const db = postgres(databaseUrl, {
    max: 2,
    idle_timeout: 5,
    connect_timeout: 10,
    onnotice: () => {},
  });
  try {
    const tables = await db`
      select
        to_regclass('public.seo_indexing_decisions') is not null as has_decisions,
        to_regclass('public.seo_fingerprints') is not null as has_fingerprints`;
    if (!tables[0].has_decisions || !tables[0].has_fingerprints) {
      const absent = [
        !tables[0].has_decisions && "seo_indexing_decisions",
        !tables[0].has_fingerprints && "seo_fingerprints",
      ].filter(Boolean);
      if (!apply) {
        console.log(
          `VPS schema is missing ${absent.join(", ")}; dry run made no schema changes. Rerun with --apply to create the canonical schema.`,
        );
        return { applied: false, missingSchema: absent };
      }
      await ensureSchema(db);
      console.log("Created missing SEO gate schema objects on VPS.");
    }

    const summary = [];
    for (const spec of TABLES) {
      await verifyColumns(db, supabaseUrl, serviceKey, spec);
      const sourceRows = await sourceCount(supabaseUrl, serviceKey, spec.name);
      const targetRows = await countTarget(db, spec.name);
      const targetValues = await readTargetRows(db, spec);
      const scan = await scanSource(supabaseUrl, serviceKey, spec, targetValues, sourceRows);
      summary.push({ spec, sourceRows, targetRows, targetValues, ...scan });
      console.log(
        `${spec.name}: Supabase=${sourceRows}, VPS=${targetRows}, missing=${scan.missing}, conflicts=${scan.conflicts}`,
      );
      const differingFields = Object.entries(scan.conflictFields || {})
        .sort((left, right) => right[1] - left[1])
        .map(([field, count]) => `${field}=${count}`)
        .join(", ");
      if (differingFields)
        console.log(
          `${spec.name} differing fields: ${differingFields}; timestamp direction: ${JSON.stringify(scan.timestampDirection)}`,
        );
      if (scan.missing)
        console.log(
          `${spec.name} absent-row details: by-layer=${JSON.stringify(scan.missingLayers)}, timestamp-range=${JSON.stringify(scan.missingTimeRange)}`,
        );
    }

    const conflicts = summary.reduce((total, item) => total + item.conflicts, 0);
    const missing = summary.reduce((total, item) => total + item.missing, 0);
    if (!apply) {
      console.log(
        `Dry run: ${missing} absent rows could be inserted; ${conflicts} conflicting rows would remain unchanged. No data was written.`,
      );
      return { applied: false, missing, conflicts };
    }
    if (conflicts)
      throw new Error(
        `${conflicts} same-key rows differ; refusing to copy until source/target divergence is reconciled`,
      );
    if (!missing) {
      console.log(
        `No absent rows to insert; ${conflicts} same-key conflicts, if any, remain unchanged.`,
      );
      return { applied: true, missing: 0, conflicts };
    }

    const backup = await backupGate(databaseUrl);
    console.log(`Verified pre-copy backup: ${basename(backup.directory)} (${backup.checksum})`);

    for (const item of summary) {
      if (!item.missing) continue;
      let inserted = 0;
      for await (const rows of sourcePages(supabaseUrl, serviceKey, item.spec)) {
        const classified = classifyRows(rows, item.targetValues, item.spec);
        inserted += await insertMissing(db, item.spec, classified.missing);
      }
      if (inserted !== item.missing)
        throw new Error(
          `${item.spec.name} source changed during copy; expected ${item.missing} rows, saw ${inserted}`,
        );
      console.log(`${item.spec.name}: inserted ${inserted} missing rows.`);
    }

    for (const item of summary) {
      const finalTargetRows = await countTarget(db, item.spec.name);
      const finalTargetValues = await readTargetRows(db, item.spec);
      const finalSourceCount = await sourceCount(supabaseUrl, serviceKey, item.spec.name);
      const finalScan = await scanSource(
        supabaseUrl,
        serviceKey,
        item.spec,
        finalTargetValues,
        finalSourceCount,
      );
      if (
        finalScan.missing ||
        finalScan.conflicts !== item.conflicts ||
        finalScan.conflictSignature !== item.conflictSignature ||
        finalSourceCount !== item.sourceRows
      )
        throw new Error(`${item.spec.name} post-copy verification failed`);
      console.log(
        `${item.spec.name}: verified Supabase=${finalSourceCount}, VPS=${finalTargetRows}, missing=0, conflicts=${finalScan.conflicts} (unchanged)`,
      );
    }
    console.log("Copy complete. Supabase rows were not deleted or modified.");
    return { applied: true, missing, conflicts };
  } finally {
    await db.end({ timeout: 5 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const apply = process.argv.includes("--apply");
  runCopy({ apply }).catch((error) => {
    console.error(`SEO gate copy failed: ${error.message}`);
    process.exitCode = 1;
  });
}
