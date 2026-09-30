// Award Management Center — the awards, read from and written to `awards`.
//
// This was a placeholder store that lived in the browser and started empty
// ("replace with supabase.from('awards') once the schema lands"). The schema
// landed: `awards` holds every trophy, badge, achievement, rank, milestone and
// streak - 181 of them - and the database's own ams_claim_award and
// ams_issue_awards already work from it. The Award Center showed none of them,
// and anything created there vanished on reload.
//
// Every function keeps its signature, so the screens are unchanged. Reading is
// open to anyone signed in; writing is decided by the table's own policy,
// ams_is_operator(), and a refusal is passed up as the error it is. Each change
// is appended to the award's own audit trail, with who made it.

import { supabase } from "@/integrations/supabase/client";

import type {
  Award, AwardAuditEntry, AwardFilters, AwardRewards, AwardStatus,
  AwardType, AwardCategory, Department, PageResult, Rarity,
} from "./types";

// `awards` is not in the generated types; this is the one place that says so.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const awards = () => (supabase as any).from("awards");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const userAwards = () => (supabase as any).from("user_awards");

const now = () => new Date().toISOString();
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${performance.now().toString(36).replace(".", "")}`);

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type Row = {
  id: string; slug: string; name: string; description: string | null; type: string;
  category: string | null; rarity: string | null; department: string | null; priority: number | null;
  status: string; visibility: string | null; media: unknown; unlock_conditions: unknown;
  eligibility_rules: unknown; supported_modules: unknown; supported_roles: unknown;
  rewards: unknown; versions: unknown; audit: unknown; created_at: string; updated_at: string;
};

const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function fromRow(r: Row, earned = 0): Award {
  const rewards = (r.rewards ?? {}) as Partial<AwardRewards>;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description ?? "",
    type: r.type as AwardType,
    category: (r.category ?? "") as AwardCategory,
    rarity: (r.rarity ?? "common") as Rarity,
    department: (r.department ?? undefined) as Department | undefined,
    priority: r.priority ?? 0,
    status: r.status as AwardStatus,
    visibility: (r.visibility ?? "public") as Award["visibility"],
    media: (r.media ?? {}) as Award["media"],
    unlockConditions: list(r.unlock_conditions),
    eligibilityRules: list(r.eligibility_rules),
    supportedModules: list<string>(r.supported_modules),
    supportedRoles: list<string>(r.supported_roles),
    rewards: { xp: 0, coins: 0, rankImpact: 0, levelImpact: 0, monetaryValue: 0, ...rewards },
    versions: list(r.versions),
    audit: list(r.audit),
    usage: { earnedCount: earned },
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** The columns a patch touches, under the table's own names. */
function toRow(a: Partial<Award>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (a.slug !== undefined) out.slug = a.slug;
  if (a.name !== undefined) out.name = a.name;
  if (a.description !== undefined) out.description = a.description;
  if (a.type !== undefined) out.type = a.type;
  if (a.category !== undefined) out.category = a.category;
  if (a.rarity !== undefined) out.rarity = a.rarity;
  if (a.department !== undefined) out.department = a.department ?? null;
  if (a.priority !== undefined) out.priority = a.priority;
  if (a.status !== undefined) out.status = a.status;
  if (a.visibility !== undefined) out.visibility = a.visibility;
  if (a.media !== undefined) out.media = a.media;
  if (a.unlockConditions !== undefined) out.unlock_conditions = a.unlockConditions;
  if (a.eligibilityRules !== undefined) out.eligibility_rules = a.eligibilityRules;
  if (a.supportedModules !== undefined) out.supported_modules = a.supportedModules;
  if (a.supportedRoles !== undefined) out.supported_roles = a.supportedRoles;
  if (a.rewards !== undefined) out.rewards = a.rewards;
  if (a.versions !== undefined) out.versions = a.versions;
  return out;
}

async function actor(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? data.user?.id ?? "unknown";
}

async function entry(action: string): Promise<AwardAuditEntry> {
  return { id: uid(), at: now(), actor: await actor(), action } as AwardAuditEntry;
}

/** How many people have earned each award. */
async function earnedCounts(ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!ids.length) return counts;
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await userAwards().select("award_id").in("award_id", ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as { award_id: string }[]) {
      counts.set(row.award_id, (counts.get(row.award_id) ?? 0) + 1);
    }
  }
  return counts;
}

export async function listAwards(filters: AwardFilters = {}): Promise<PageResult<Award>> {
  let q = awards().select("*", { count: "exact" }).order("priority", { ascending: false }).order("name");
  if (filters.search) {
    const s = filters.search.replace(/[%,()]/g, " ").trim();
    if (s) q = q.or(`name.ilike.%${s}%,description.ilike.%${s}%`);
  }
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.type) q = q.eq("type", filters.type);
  if (filters.rarity) q = q.eq("rarity", filters.rarity);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.visibility) q = q.eq("visibility", filters.visibility);
  if (filters.department) q = q.eq("department", filters.department);
  if (filters.module) q = q.contains("supported_modules", [filters.module]);
  if (filters.role) q = q.contains("supported_roles", [filters.role]);
  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const counts = await earnedCounts(rows.map((r) => r.id));
  let out = rows.map((r) => fromRow(r, counts.get(r.id) ?? 0));
  // XP sits inside the rewards document, so it is compared here.
  if (filters.minXp) out = out.filter((a) => a.rewards.xp >= (filters.minXp ?? 0));
  return { rows: out, total: out.length };
}

export async function getAward(id: string): Promise<Award | null> {
  const { data, error } = await awards().select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const counts = await earnedCounts([id]);
  return fromRow(data as Row, counts.get(id) ?? 0);
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
  const by = await actor();
  // A slug is unique; a clash gets the next free number rather than failing.
  const base = slugify(draft.name) || uid();
  const { data: taken } = await awards().select("slug").like("slug", `${base}%`);
  const used = new Set(((taken ?? []) as { slug: string }[]).map((t) => t.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;

  const { data, error } = await awards()
    .insert({
      slug,
      name: draft.name,
      description: draft.description ?? "",
      type: draft.type,
      category: draft.category,
      rarity: draft.rarity,
      department: draft.department ?? null,
      priority: draft.priority ?? 0,
      status: "draft",
      visibility: draft.visibility ?? "public",
      media: draft.media ?? {},
      unlock_conditions: [],
      eligibility_rules: [],
      supported_modules: draft.supportedModules ?? [],
      supported_roles: draft.supportedRoles ?? [],
      rewards: { xp: 0, coins: 0, rankImpact: 0, levelImpact: 0, monetaryValue: 0, ...draft.rewards },
      versions: [{ version: 1, createdAt: now(), createdBy: by }],
      audit: [{ id: uid(), at: now(), actor: by, action: "created" }],
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return fromRow(data as Row);
}

export async function updateAward(id: string, patch: Partial<Award>, action = "updated"): Promise<Award> {
  const current = await getAward(id);
  if (!current) throw new Error("Award not found");
  const { data, error } = await awards()
    .update({
      ...toRow(patch),
      audit: [await entry(action), ...current.audit],
      updated_at: now(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return fromRow(data as Row, current.usage.earnedCount);
}

const setStatus = (id: string, status: AwardStatus, action: string) => updateAward(id, { status }, action);

export const archiveAward    = (id: string) => setStatus(id, "archived", "archived");
export const restoreAward    = (id: string) => setStatus(id, "draft", "restored");
export const approveAward    = (id: string) => setStatus(id, "approved", "approved");
export const rejectAward     = (id: string) => setStatus(id, "rejected", "rejected");
export const publishAward    = (id: string) => setStatus(id, "published", "published");
export const unpublishAward  = (id: string) => setStatus(id, "unpublished", "unpublished");
export const disableAward    = (id: string) => setStatus(id, "disabled", "disabled");
export const enableAward     = (id: string) => setStatus(id, "draft", "enabled");

/**
 * An award someone has already earned is not deleted: their record of it
 * would go with it. It can be archived instead.
 */
async function refuseIfEarned(ids: string[]) {
  const counts = await earnedCounts(ids);
  const earned = ids.filter((id) => (counts.get(id) ?? 0) > 0);
  if (earned.length) {
    throw new Error(
      `${earned.length === 1 ? "This award has" : `${earned.length} of these awards have`} been earned by someone, so ${earned.length === 1 ? "it" : "they"} cannot be deleted. Archive instead.`,
    );
  }
}

export async function deleteAward(id: string): Promise<void> {
  await refuseIfEarned([id]);
  const { error } = await awards().delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function cloneAward(id: string): Promise<Award> {
  const src = await getAward(id);
  if (!src) throw new Error("Award not found");
  return createAward({
    name: `${src.name} (Copy)`,
    description: src.description,
    type: src.type,
    category: src.category,
    rarity: src.rarity,
    department: src.department,
    priority: src.priority,
    visibility: src.visibility,
    rewards: src.rewards,
    media: src.media,
    supportedModules: src.supportedModules,
    supportedRoles: src.supportedRoles,
  });
}

export async function bulkUpdate(ids: string[], patch: Partial<Award>): Promise<number> {
  let n = 0;
  for (const id of ids) {
    await updateAward(id, patch);
    n++;
  }
  return n;
}

export async function bulkDelete(ids: string[]): Promise<number> {
  await refuseIfEarned(ids);
  const { data, error } = await awards().delete().in("id", ids).select("id");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]).length;
}

export async function bulkSetStatus(ids: string[], status: AwardStatus): Promise<number> {
  let n = 0;
  for (const id of ids) {
    await setStatus(id, status, `bulk:${status}`);
    n++;
  }
  return n;
}
