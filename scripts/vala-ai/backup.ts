/**
 * Vala AI database backup and restore.
 *
 *   node scripts/vala-ai/backup.ts --out /var/backups/vala-ai --keep 14
 *   node scripts/vala-ai/backup.ts --restore /var/backups/vala-ai/vala-20261009T020000Z.db --to /var/lib/vala-ai
 *
 * Backup is safe while the server runs. Restore only with the server stopped.
 * VALA_AI_DATA_DIR selects the database that is backed up (default ./.vala-ai).
 */
import {
  backupDatabase,
  defaultBackupDir,
  inspectDatabase,
  restoreDatabase,
} from "../../src/lib/vala-ai/backup.server.ts";
import { closeDb } from "../../src/lib/vala-ai/db.server.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

try {
  const restore = arg("restore");
  if (restore) {
    const to = arg("to");
    if (!to) throw new Error("--to <data directory> is required with --restore.");
    const r = restoreDatabase(restore, to);
    const check = inspectDatabase(r.restoredTo);
    console.log(
      `Restored ${restore} -> ${r.restoredTo} (integrity ${check.detail}, ${check.tables} tables, schema v${check.schemaVersion})`,
    );
    if (r.previous) console.log(`Previous database kept as ${r.previous}`);
  } else {
    const keep = Number(arg("keep") ?? "14");
    const r = backupDatabase({ dir: arg("out") ?? defaultBackupDir(), keep });
    console.log(`Backup ${r.path} (${r.bytes} bytes, ${r.tables} tables, sha256 ${r.sha256})`);
    if (r.removed.length) console.log(`Removed by retention: ${r.removed.join(", ")}`);
  }
  closeDb();
} catch (e) {
  console.error(`Vala AI backup: ${(e as Error).message}`);
  process.exit(1);
}
