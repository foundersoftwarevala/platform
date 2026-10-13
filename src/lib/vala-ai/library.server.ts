import { audit } from "./audit.server.ts";
import { all, run, tx } from "./db.server.ts";
import { newId, now, parseJson, sha256, ValaError } from "./util.server.ts";

/**
 * Software library index. The scan runs in the operator's browser over the
 * read-only SSD folder (File System Access API); only metadata reaches the
 * server. Re-importing the same root + path updates the row instead of
 * duplicating it, so one codebase = one record.
 */

export type LibraryItem = {
  id: string;
  name: string;
  version: string;
  root_label: string;
  rel_path: string;
  stack: string[];
  features: string[];
  file_count: number;
  size_bytes: number;
  manifest_sha256: string;
  scanned_by: string;
  scanned_at: string;
};

const MAX_ITEMS = 2000;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, maxItems: number) =>
  Array.isArray(v)
    ? [...new Set(v.map((x) => text(x, 60).toLowerCase()).filter(Boolean))].slice(0, maxItems)
    : [];
const count = (v: unknown) => (Number.isFinite(v) && (v as number) >= 0 ? Math.floor(v as number) : -1);

export function importLibrary(body: Record<string, unknown>, actor: string) {
  const root = text(body.rootLabel, 120);
  if (!root) throw new ValaError(400, "Give the SSD folder a label (rootLabel).");
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) throw new ValaError(400, "No library items to import.");
  if (items.length > MAX_ITEMS)
    throw new ValaError(413, `At most ${MAX_ITEMS} items per import; split the scan.`);

  const clean = items.map((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const name = text(r.name, 160);
    const relPath = text(r.relPath, 500);
    const files = count(r.fileCount);
    const size = count(r.sizeBytes);
    const manifest = text(r.manifestSha256, 64);
    if (!name || !relPath) throw new ValaError(400, `Item ${i + 1}: name and relPath are required.`);
    if (relPath.includes("..") || relPath.startsWith("/"))
      throw new ValaError(400, `Item ${i + 1}: relPath must stay inside the scanned folder.`);
    if (files < 0 || size < 0) throw new ValaError(400, `Item ${i + 1}: fileCount and sizeBytes must be numbers.`);
    if (!/^[a-f0-9]{64}$/.test(manifest))
      throw new ValaError(400, `Item ${i + 1}: manifestSha256 must be a SHA-256 hex digest.`);
    if ("content" in r || "files" in r)
      throw new ValaError(400, "Library import accepts metadata only, never file contents.");
    return {
      name,
      version: text(r.version, 40),
      relPath,
      stack: list(r.stack, 20),
      features: list(r.features, 60),
      files,
      size,
      manifest,
    };
  });

  const at = now();
  let created = 0;
  let updated = 0;
  tx(() => {
    for (const c of clean) {
      const existing = all<{ id: string }>(
        "select id from library_items where root_label = ? and rel_path = ?",
        root,
        c.relPath,
      )[0];
      if (existing) {
        run(
          "update library_items set name=?, version=?, stack_json=?, features_json=?, file_count=?, size_bytes=?, manifest_sha256=?, scanned_by=?, scanned_at=? where id=?",
          c.name, c.version, JSON.stringify(c.stack), JSON.stringify(c.features), c.files, c.size, c.manifest, actor, at, existing.id,
        );
        updated++;
      } else {
        run(
          "insert into library_items (id, name, version, root_label, rel_path, stack_json, features_json, file_count, size_bytes, manifest_sha256, scanned_by, scanned_at) values (?,?,?,?,?,?,?,?,?,?,?,?)",
          newId("LIB"), c.name, c.version, root, c.relPath, JSON.stringify(c.stack), JSON.stringify(c.features), c.files, c.size, c.manifest, actor, at,
        );
        created++;
      }
    }
    audit(actor, "library.import", "library", root, {
      created,
      updated,
      items: clean.length,
      batch_sha256: sha256(JSON.stringify(clean.map((c) => [c.relPath, c.manifest]))),
    });
  });
  return { created, updated, total: clean.length };
}

type Row = Omit<LibraryItem, "stack" | "features"> & { stack_json: string; features_json: string };

export function listLibrary(q: string): { items: LibraryItem[]; total: number } {
  const rows = all<Row>("select * from library_items order by name, version");
  const items = rows.map(({ stack_json, features_json, ...r }) => ({
    ...r,
    stack: parseJson<string[]>(stack_json, []),
    features: parseJson<string[]>(features_json, []),
  }));
  const tokens = q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  if (tokens.length === 0) return { items: items.slice(0, 500), total: items.length };
  const scored = items
    .map((it) => {
      const hay = [it.name, it.rel_path, ...it.stack, ...it.features].join(" ").toLowerCase();
      return { it, score: tokens.filter((t) => hay.includes(t)).length };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.it.name.localeCompare(b.it.name));
  return { items: scored.slice(0, 500).map((s) => s.it), total: scored.length };
}
