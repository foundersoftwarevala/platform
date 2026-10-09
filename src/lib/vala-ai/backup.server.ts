import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { paths } from "./config.server.ts";
import { db } from "./db.server.ts";
import { sha256 } from "./util.server.ts";

/**
 * Backups of the Vala AI database.
 *
 * `VACUUM INTO` writes a complete, consistent copy while the server keeps
 * running (it reads one snapshot, WAL included). Each copy is opened again and
 * checked with `integrity_check` before it counts as a backup, a SHA-256 is
 * written beside it, and only the newest `keep` copies are kept.
 *
 * Workspaces, evidence logs and release patches live next to the database in
 * the data directory; the database records their paths and hashes. Back up the
 * whole data directory at file level as well (see docs/vala-ai/BACKUP.md).
 *
 * Imports only Node built-ins and relative files, so `scripts/vala-ai/backup.ts`
 * can run it directly with node.
 */

export type BackupResult = {
  path: string;
  bytes: number;
  sha256: string;
  tables: number;
  removed: string[];
};

const NAME = /^vala-\d{8}T\d{6}Z\.db$/;

function stamp(d = new Date()): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/** Opens a database file read-only and returns its integrity verdict and table count. */
export function inspectDatabase(file: string): {
  ok: boolean;
  detail: string;
  tables: number;
  schemaVersion: number;
} {
  const h = new DatabaseSync(file, { readOnly: true });
  try {
    const rows = h.prepare("pragma integrity_check").all() as { integrity_check: string }[];
    const detail = rows.map((r) => r.integrity_check).join("; ");
    const tables = Number(
      (
        h.prepare("select count(*) as n from sqlite_master where type = 'table'").get() as {
          n: number;
        }
      ).n,
    );
    const schemaVersion = Number(
      (h.prepare("pragma user_version").get() as { user_version: number }).user_version,
    );
    return { ok: detail === "ok", detail, tables, schemaVersion };
  } finally {
    h.close();
  }
}

export function backupDatabase(opts: { dir: string; keep: number; now?: Date }): BackupResult {
  if (!Number.isInteger(opts.keep) || opts.keep < 1)
    throw new Error("keep must be a whole number of at least 1.");
  const dir = resolve(opts.dir);
  mkdirSync(dir, { recursive: true });
  const target = join(dir, `vala-${stamp(opts.now)}.db`);
  if (existsSync(target)) throw new Error(`A backup named ${basename(target)} already exists.`);
  const partial = `${target}.partial`;
  rmSync(partial, { force: true });
  db().exec(`vacuum into '${partial.replace(/'/g, "''")}'`);
  const check = inspectDatabase(partial);
  if (!check.ok) {
    rmSync(partial, { force: true });
    throw new Error(`Backup failed its integrity check: ${check.detail}`);
  }
  renameSync(partial, target);
  const hash = sha256(readFileSync(target));
  writeFileSync(`${target}.sha256`, `${hash}  ${basename(target)}\n`);

  const existing = readdirSync(dir)
    .filter((f) => NAME.test(f))
    .sort();
  const removed = existing.slice(0, Math.max(0, existing.length - opts.keep));
  for (const f of removed) {
    rmSync(join(dir, f), { force: true });
    rmSync(join(dir, `${f}.sha256`), { force: true });
  }
  return {
    path: target,
    bytes: statSync(target).size,
    sha256: hash,
    tables: check.tables,
    removed,
  };
}

/**
 * Restores a backup as the database of `dataDir`. Only for a stopped server:
 * it refuses a backup whose hash or integrity does not check out, and keeps the
 * database it replaces as `vala.db.replaced-<time>`.
 */
export function restoreDatabase(
  backupFile: string,
  dataDir: string,
): { restoredTo: string; previous: string | null } {
  const file = resolve(backupFile);
  const sidecar = `${file}.sha256`;
  if (!existsSync(sidecar))
    throw new Error(
      "The backup has no .sha256 file beside it; refusing to restore an unverified copy.",
    );
  const expected = readFileSync(sidecar, "utf8").trim().split(/\s+/)[0];
  if (sha256(readFileSync(file)) !== expected)
    throw new Error("The backup does not match its recorded SHA-256.");
  const check = inspectDatabase(file);
  if (!check.ok) throw new Error(`The backup fails its integrity check: ${check.detail}`);

  const target = resolve(dataDir, "vala.db");
  mkdirSync(resolve(dataDir), { recursive: true });
  let previous: string | null = null;
  if (existsSync(target)) {
    previous = `${target}.replaced-${stamp()}`;
    renameSync(target, previous);
    for (const ext of ["-wal", "-shm"])
      if (existsSync(target + ext)) renameSync(target + ext, previous + ext);
  }
  copyFileSync(file, target);
  return { restoredTo: target, previous };
}

export function defaultBackupDir(): string {
  return resolve(paths.db(), "..", "backups");
}
