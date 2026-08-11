// Generic in-memory CRUD store for every (role, module) workspace.
// Frontend-only — survives navigation, resets on hard reload.

import { useSyncExternalStore } from "react";

export type RecordStatus = "active" | "pending" | "archived" | "draft" | "approved" | "rejected";

export type CrudComment = { id: string; author: string; text: string; date: string };
export type CrudAudit = { id: string; action: string; by: string; date: string; detail?: string };
export type CrudAttachment = { id: string; name: string; size: number; date: string };

export type CrudRecord = {
  id: string;
  name: string;
  status: RecordStatus;
  owner: string;
  category: string;
  amount: number;
  date: string;            // ISO
  notes: string;
  tags: string[];
  comments: CrudComment[];
  audit: CrudAudit[];
  attachments: CrudAttachment[];
  // module-specific extras land in `extra`
  extra: Record<string, string | number>;
};

type Key = string; // `${role}:${module}`
type Listener = () => void;

const data: Map<Key, CrudRecord[]> = new Map();
const listeners: Map<Key, Set<Listener>> = new Map();

function key(role: string, module: string): Key { return `${role}:${module}`; }
function emit(k: Key) { listeners.get(k)?.forEach((l) => l()); }

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function nowIso() { return new Date().toISOString(); }

function audit(rec: CrudRecord, action: string, detail?: string) {
  rec.audit.unshift({ id: uid(), action, by: "you", date: nowIso(), detail });
  if (rec.audit.length > 50) rec.audit.length = 50;
}

const SAMPLE_OWNERS = ["Aarav Mehta", "Priya Shah", "Liam Cohen", "Maya Patel", "Noah Singh", "Ava Khan", "Ethan Roy", "Zoya Iyer"];
const SAMPLE_CATEGORIES = ["Core", "Growth", "Premium", "Starter", "Enterprise", "Trial"];
const SAMPLE_TAGS = ["priority", "internal", "vip", "renewal", "review", "automation", "promo", "kickoff"];
const STATUSES: RecordStatus[] = ["active", "pending", "archived", "draft", "approved", "rejected"];

function pick<T>(arr: readonly T[], i: number): T { return arr[i % arr.length]; }

// Production policy: every workspace starts EMPTY. No dummy data, no fake stats.
// Records are created exclusively through the UI (or Import).
function seed(_role: string, _module: string): CrudRecord[] {
  return [];
}
// Keep sample-data helpers referenced so we can re-enable demo seeding from a
// debug switch later without TS6133 unused warnings.
void SAMPLE_OWNERS; void SAMPLE_CATEGORIES; void SAMPLE_TAGS; void STATUSES; void pick;

function ensure(role: string, module: string): CrudRecord[] {
  const k = key(role, module);
  if (!data.has(k)) data.set(k, seed(role, module));
  return data.get(k)!;
}

function set(role: string, module: string, next: CrudRecord[]) {
  const k = key(role, module);
  data.set(k, next);
  emit(k);
}

function subscribe(k: Key, listener: Listener) {
  if (!listeners.has(k)) listeners.set(k, new Set());
  listeners.get(k)!.add(listener);
  return () => { listeners.get(k)?.delete(listener); };
}

// ---------- Public hook ----------
export function useCrud(role: string, module: string) {
  const k = key(role, module);
  ensure(role, module);
  const records = useSyncExternalStore(
    (l) => subscribe(k, l),
    () => data.get(k)!,
    () => data.get(k)!,
  );

  return {
    records,
    create(input: Partial<CrudRecord>): CrudRecord {
      const list = ensure(role, module);
      const rec: CrudRecord = {
        id: uid(),
        name: input.name?.trim() || "Untitled",
        status: input.status || "draft",
        owner: input.owner || "you",
        category: input.category || "Core",
        amount: input.amount ?? 0,
        date: input.date || nowIso(),
        notes: input.notes || "",
        tags: input.tags || [],
        comments: [],
        audit: [],
        attachments: [],
        extra: input.extra || {},
      };
      audit(rec, "created", `Created '${rec.name}'`);
      set(role, module, [rec, ...list]);
      return rec;
    },
    update(id: string, patch: Partial<CrudRecord>) {
      const list = ensure(role, module);
      set(
        role,
        module,
        list.map((r) => {
          if (r.id !== id) return r;
          const next = { ...r, ...patch };
          audit(next, "updated", Object.keys(patch).join(", "));
          return next;
        }),
      );
    },
    remove(id: string) {
      const list = ensure(role, module);
      set(role, module, list.filter((r) => r.id !== id));
    },
    bulkRemove(ids: string[]) {
      const list = ensure(role, module);
      const set2 = new Set(ids);
      set(role, module, list.filter((r) => !set2.has(r.id)));
    },
    setStatus(id: string, status: RecordStatus) {
      const list = ensure(role, module);
      set(
        role,
        module,
        list.map((r) => {
          if (r.id !== id) return r;
          const next = { ...r, status };
          audit(next, "status", `→ ${status}`);
          return next;
        }),
      );
    },
    bulkSetStatus(ids: string[], status: RecordStatus) {
      const list = ensure(role, module);
      const sset = new Set(ids);
      set(
        role,
        module,
        list.map((r) => {
          if (!sset.has(r.id)) return r;
          const next = { ...r, status };
          audit(next, "status", `→ ${status}`);
          return next;
        }),
      );
    },
    duplicate(id: string): CrudRecord | null {
      const list = ensure(role, module);
      const src = list.find((r) => r.id === id);
      if (!src) return null;
      const copy: CrudRecord = {
        ...src,
        id: uid(),
        name: `${src.name} (copy)`,
        date: nowIso(),
        audit: [],
        comments: [],
      };
      audit(copy, "duplicated", `From ${src.id}`);
      set(role, module, [copy, ...list]);
      return copy;
    },
    addComment(id: string, text: string) {
      const list = ensure(role, module);
      set(
        role,
        module,
        list.map((r) => {
          if (r.id !== id) return r;
          const next = { ...r, comments: [{ id: uid(), author: "you", text, date: nowIso() }, ...r.comments] };
          audit(next, "commented");
          return next;
        }),
      );
    },
    addAttachment(id: string, name: string, size: number) {
      const list = ensure(role, module);
      set(
        role,
        module,
        list.map((r) => {
          if (r.id !== id) return r;
          const next = { ...r, attachments: [{ id: uid(), name, size, date: nowIso() }, ...r.attachments] };
          audit(next, "attached", name);
          return next;
        }),
      );
    },
    importJson(json: string): number {
      try {
        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed)) return 0;
        const list = ensure(role, module);
        const incoming: CrudRecord[] = parsed.map((p: Partial<CrudRecord>) => ({
          id: uid(),
          name: String(p.name ?? "Imported"),
          status: (p.status as RecordStatus) ?? "draft",
          owner: String(p.owner ?? "you"),
          category: String(p.category ?? "Core"),
          amount: Number(p.amount ?? 0),
          date: String(p.date ?? nowIso()),
          notes: String(p.notes ?? ""),
          tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
          comments: [],
          audit: [{ id: uid(), action: "imported", by: "you", date: nowIso() }],
          attachments: [],
          extra: (p.extra as Record<string, string | number>) ?? {},
        }));
        set(role, module, [...incoming, ...list]);
        return incoming.length;
      } catch { return 0; }
    },
    reset() {
      set(role, module, seed(role, module));
    },
  };
}

export function exportJson(records: CrudRecord[]): string {
  return JSON.stringify(records, null, 2);
}

export function downloadFile(filename: string, content: string, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}
