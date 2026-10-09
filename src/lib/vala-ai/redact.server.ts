import { isAbsolute } from "node:path";
import type { Role } from "./auth.server.ts";
import { dataDir } from "./config.server.ts";

/**
 * What a non-owner may see of the server's own layout.
 *
 * Owners see responses unchanged. For operators and viewers every response is
 * walked once: the runner and lease owners (process ids) are hidden, any value
 * that is an absolute filesystem path (data directory, workspace, source
 * repository, evidence and patch files) is hidden, and the data directory is
 * replaced by `<vala-data>` wherever it appears inside longer text such as
 * audit details, event messages and command output. Relative workspace paths,
 * which the file browser and diffs need, are left as they are.
 */

const HIDDEN = "(hidden)";
const PROCESS_KEYS = new Set(["owner", "lease_owner"]);
const WINDOWS_ABSOLUTE = /^[A-Za-z]:[\\/]/;

function looksAbsolute(s: string): boolean {
  return (isAbsolute(s) && /[\\/]/.test(s) && !s.startsWith("//")) || WINDOWS_ABSOLUTE.test(s);
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactForRole<T>(value: T, role: Role | undefined): T {
  if (role === "owner") return value;
  const dir = dataDir();
  const variants = [...new Set([dir, dir.replace(/\\/g, "/"), dir.replace(/\//g, "\\")])];
  const embedded = new RegExp(
    variants.map(escapeRegExp).join("|"),
    process.platform === "win32" ? "gi" : "g",
  );

  const scrubText = (s: string): string => {
    const t = s.trim();
    if (!t.includes("\n") && looksAbsolute(t) && (WINDOWS_ABSOLUTE.test(t) || !/\s/.test(t)))
      return HIDDEN;
    let out = s.replace(embedded, "<vala-data>");
    // JSON stored as text (audit details, event data) gets the same treatment inside.
    if ((out.startsWith("{") || out.startsWith("[")) && out.length < 200_000) {
      try {
        out = JSON.stringify(walk(JSON.parse(out)));
      } catch {
        /* not JSON */
      }
    }
    return out;
  };

  const walk = (v: unknown, key?: string): unknown => {
    if (key && PROCESS_KEYS.has(key) && v !== null && v !== undefined) return HIDDEN;
    if (typeof v === "string") return scrubText(v);
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x, k)]),
      );
    }
    return v;
  };

  return walk(value) as T;
}
