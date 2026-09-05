// Award Management Center — API placeholder layer.
//
// Every function returns a Promise so the UI can be swapped onto a real
// backend (TanStack server functions, REST, GraphQL) without touching the
// presentation layer. Today it serves an empty in-memory store; rows
// returned reflect optimistic local mutations performed in this session.

import type {
  Award, AwardFilters, AwardRewards, AwardStatus,
  AwardType, AwardCategory, Department, PageResult, Rarity,
} from "./types";


// In-memory store for the current session. NOT persisted.
// TODO: replace with `supabase.from("awards")…` once the schema lands.
let STORE: Award[] = [];

const now = () => new Date().toISOString();
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2));

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function matches(a: Award, f: AwardFilters): boolean {
  if (f.search) {
    const q = f.search.toLowerCase();
    if (!a.name.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false;
  }
  if (f.category && a.category !== f.category) return false;
  if (f.type && a.type !== f.type) return false;
  if (f.rarity && a.rarity !== f.rarity) return false;
  if (f.status && a.status !== f.status) return false;
  if (f.visibility && a.visibility !== f.visibility) return false;
  if (f.department && a.department !== f.department) return false;
  if (f.module && !a.supportedModules.includes(f.module)) return false;

  if (f.role && !a.supportedRoles.includes(f.role)) return false;
  if (f.minXp && a.rewards.xp < f.minXp) return false;
  if (f.from && a.createdAt < f.from) return false;
  if (f.to && a.createdAt > f.to) return false;
  return true;
}

function audit(a: Award, action: string, actor = "admin"): Award {
  return {
    ...a,
    updatedAt: now(),
    audit: [{ id: uid(), at: now(), actor, action }, ...a.audit],
  };
}

export async function listAwards(filters: AwardFilters = {}): Promise<PageResult<Award>> {
  const rows = STORE.filter((a) => matches(a, filters));
  return { rows, total: rows.length };
}

export async function getAward(id: string): Promise<Award | null> {
  return STORE.find((a) => a.id === id) ?? null;
}

export interface AwardDraft {
  name: string;
  description?: string;
  type: AwardType;
  category: AwardCategory;
  rarity: Rarity;
  department?: Department;
  priority?: number;
  visibility?: Award["visibility"];
  rewards?: Partial<AwardRewards>;
  media?: Award["media"];
  supportedModules?: string[];
  supportedRoles?: string[];
}


export async function createAward(draft: AwardDraft): Promise<Award> {
  const a: Award = {
    id: uid(),
    slug: slugify(draft.name) || uid(),
    name: draft.name,
    description: draft.description ?? "",
    type: draft.type,
    category: draft.category,
    rarity: draft.rarity,
    department: draft.department,
    priority: draft.priority ?? 0,

    status: "draft",
    visibility: draft.visibility ?? "public",
    media: draft.media ?? {},
    unlockConditions: [],
    eligibilityRules: [],
    supportedModules: draft.supportedModules ?? [],
    supportedRoles: draft.supportedRoles ?? [],
    rewards: { xp: 0, coins: 0, rankImpact: 0, levelImpact: 0, monetaryValue: 0, ...draft.rewards },
    versions: [{ version: 1, createdAt: now(), createdBy: "admin" }],
    audit: [{ id: uid(), at: now(), actor: "admin", action: "created" }],
    usage: { earnedCount: 0 },
    createdAt: now(),
    updatedAt: now(),
  };
  STORE = [a, ...STORE];
  return a;
}

export async function updateAward(id: string, patch: Partial<Award>): Promise<Award> {
  const idx = STORE.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error("Award not found");
  const next = audit({ ...STORE[idx], ...patch }, "updated");
  STORE[idx] = next;
  return next;
}

async function setStatus(id: string, status: AwardStatus, action: string): Promise<Award> {
  return updateAward(id, { status, audit: undefined as never }).then(async () => {
    const idx = STORE.findIndex((a) => a.id === id);
    STORE[idx] = audit({ ...STORE[idx], status }, action);
    return STORE[idx];
  });
}

export const archiveAward    = (id: string) => setStatus(id, "archived", "archived");
export const restoreAward    = (id: string) => setStatus(id, "draft", "restored");
export const approveAward    = (id: string) => setStatus(id, "approved", "approved");
export const rejectAward     = (id: string) => setStatus(id, "rejected", "rejected");
export const publishAward    = (id: string) => setStatus(id, "published", "published");
export const unpublishAward  = (id: string) => setStatus(id, "unpublished", "unpublished");
export const disableAward    = (id: string) => setStatus(id, "disabled", "disabled");
export const enableAward     = (id: string) => setStatus(id, "draft", "enabled");

export async function deleteAward(id: string): Promise<void> {
  STORE = STORE.filter((a) => a.id !== id);
}

export async function cloneAward(id: string): Promise<Award> {
  const src = STORE.find((a) => a.id === id);
  if (!src) throw new Error("Award not found");
  const copy = await createAward({
    name: `${src.name} (Copy)`,
    description: src.description,
    type: src.type,
    category: src.category,
    rarity: src.rarity,
    priority: src.priority,
    visibility: src.visibility,
    rewards: src.rewards,
    media: src.media,
    supportedModules: src.supportedModules,
    supportedRoles: src.supportedRoles,
  });
  return copy;
}

export async function bulkUpdate(ids: string[], patch: Partial<Award>): Promise<number> {
  let n = 0;
  for (const id of ids) {
    try { await updateAward(id, patch); n++; } catch { /* skip */ }
  }
  return n;
}

export async function bulkDelete(ids: string[]): Promise<number> {
  const before = STORE.length;
  STORE = STORE.filter((a) => !ids.includes(a.id));
  return before - STORE.length;
}

export async function bulkSetStatus(ids: string[], status: AwardStatus): Promise<number> {
  let n = 0;
  for (const id of ids) {
    try { await setStatus(id, status, `bulk:${status}`); n++; } catch { /* skip */ }
  }
  return n;
}
