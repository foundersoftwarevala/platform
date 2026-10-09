import { all, one, run } from "./db.server.ts";
import { now, sha256 } from "./util.server.ts";

/**
 * Append-only, hash-chained activity record.
 *
 * Each entry's hash covers its content and the previous entry's hash, so any
 * edit made to the file outside the application breaks the chain from that
 * point on, and `verifyAuditChain` says exactly where.
 */

export type AuditEntry = {
  seq: number;
  at: string;
  actor: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail_json: string;
  prev_hash: string;
  hash: string;
};

const GENESIS = "0".repeat(64);

function entryHash(e: Omit<AuditEntry, "seq" | "hash">): string {
  return sha256(
    [
      e.prev_hash,
      e.at,
      e.actor,
      e.action,
      e.target_type ?? "",
      e.target_id ?? "",
      e.detail_json,
    ].join("\u001f"),
  );
}

export function audit(
  actor: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  detail: Record<string, unknown> = {},
) {
  const prev = one<{ hash: string }>("select hash from audit_log order by seq desc limit 1");
  const entry = {
    at: now(),
    actor,
    action,
    target_type: targetType,
    target_id: targetId,
    detail_json: JSON.stringify(detail),
    prev_hash: prev?.hash ?? GENESIS,
  };
  run(
    "insert into audit_log (at, actor, action, target_type, target_id, detail_json, prev_hash, hash) values (?,?,?,?,?,?,?,?)",
    entry.at,
    entry.actor,
    entry.action,
    entry.target_type,
    entry.target_id,
    entry.detail_json,
    entry.prev_hash,
    entryHash(entry),
  );
}

export function listAudit(limit = 200, before?: number): AuditEntry[] {
  return before
    ? all<AuditEntry>(
        "select * from audit_log where seq < ? order by seq desc limit ?",
        before,
        limit,
      )
    : all<AuditEntry>("select * from audit_log order by seq desc limit ?", limit);
}

export function verifyAuditChain(): { ok: boolean; entries: number; brokenAt: number | null } {
  const rows = all<AuditEntry>("select * from audit_log order by seq asc");
  let prev = GENESIS;
  for (const row of rows) {
    if (row.prev_hash !== prev || entryHash(row) !== row.hash)
      return { ok: false, entries: rows.length, brokenAt: row.seq };
    prev = row.hash;
  }
  return { ok: true, entries: rows.length, brokenAt: null };
}
