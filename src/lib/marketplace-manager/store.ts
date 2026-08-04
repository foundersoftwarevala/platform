/**
 * In-memory persistence layer for the Marketplace Manager.
 * Mirrors the shape of the upstream server functions so every section keeps
 * its full CRUD behaviour without a backend service.
 */

const KEY_PREFIX = "sv:mm:";

function load<T>(key: string, seed: T[]): T[] {
  if (typeof window === "undefined") return [...seed];
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + key);
    if (!raw) return [...seed];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [...seed];
  } catch {
    return [...seed];
  }
}

function save<T>(key: string, rows: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_PREFIX + key, JSON.stringify(rows));
  } catch {
    /* storage full or unavailable — keep the in-memory copy */
  }
}

export function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function slugify(value: string, fallback = "item") {
  return (
    (value || fallback)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || fallback
  );
}

export function createTable<T extends { id: string }>(key: string, seed: T[]) {
  let rows = load<T>(key, seed);
  return {
    all(): T[] {
      return rows.map((r) => ({ ...r }));
    },
    replace(next: T[]) {
      rows = next;
      save(key, rows);
    },
    upsert(row: T): T {
      const i = rows.findIndex((r) => r.id === row.id);
      if (i >= 0) rows[i] = { ...rows[i], ...row };
      else rows = [...rows, row];
      save(key, rows);
      return { ...(rows.find((r) => r.id === row.id) as T) };
    },
    patch(id: string, patch: Partial<T>): T | undefined {
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) return undefined;
      rows[i] = { ...rows[i], ...patch };
      save(key, rows);
      return { ...rows[i] };
    },
    remove(id: string) {
      rows = rows.filter((r) => r.id !== id);
      save(key, rows);
    },
    find(id: string): T | undefined {
      const row = rows.find((r) => r.id === id);
      return row ? { ...row } : undefined;
    },
  };
}
