// AMS Missions + Quests — kept in the `missions` and `quests` tables.
//
// This was an in-memory store: missions and quest chains made in the AMS
// Manager were gone on reload, and "+1 progress" / "Complete" paid XP and coins
// into a wallet that also lived only in the browser. The definitions now live
// in the tables the database already had for them, and what the screens show
// as progress is what people have actually done - rows in
// user_mission_progress - rather than a counter an operator clicks.
//
// The screens read a snapshot through useSyncExternalStore, as before; it is
// filled from the database and refreshed after every change. Writing is
// decided by the tables' own policy (is_admin), and a refusal comes back as the
// error it is.
//
// What the tables have no column for is kept beside the definition: a
// mission's rules, type, visibility, activation and management status in
// `conditions`; a quest's stages, mode, season and department in `steps`.

import { supabase } from "@/integrations/supabase/client";

import type {
  Mission, MissionRule, MissionStatus, MissionType,
  QuestChain, QuestMode, QuestStage,
} from "./missions.types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: "missions" | "quests" | "user_mission_progress") => (supabase as any).from(name);

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${performance.now().toString(36).replace(".", "")}`;
const now = () => new Date().toISOString();
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

let MISSIONS: Mission[] = [];
let QUESTS: QuestChain[] = [];
let loaded = false;
let loadError: string | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribeMissions(fn: Listener) {
  listeners.add(fn);
  if (!loaded) void refreshMissions();
  return () => { listeners.delete(fn); };
}
const emit = () => { missionsVersion++; for (const fn of listeners) fn(); };

// Stable snapshot for useSyncExternalStore — a fresh array on every read
// causes an infinite render loop.
let missionsVersion = 0;
let snapshotVersion = -1;
let snapshotValue: Mission[] = [];
export function missionsSnapshot(): Mission[] {
  if (snapshotVersion !== missionsVersion) {
    snapshotValue = MISSIONS;
    snapshotVersion = missionsVersion;
  }
  return snapshotValue;
}
const EMPTY_MISSIONS: Mission[] = [];
export function missionsServerSnapshot(): Mission[] { return EMPTY_MISSIONS; }

/** Why the last read failed, if it did - the screens show it rather than an empty page. */
export function missionsLoadError(): string | null { return loadError; }

/* ------------------------------ mapping ------------------------------ */

type MissionRow = {
  id: string; name: string; description: string | null; cadence: string;
  conditions: Record<string, unknown> | null; rewards: Record<string, unknown> | null;
  xp_reward: number | null; starts_at: string | null; ends_at: string | null; status: string;
  created_at: string; updated_at: string;
};

const CADENCE: Record<MissionType, string> = {
  daily: "daily", weekly: "weekly", monthly: "monthly",
  yearly: "seasonal", department: "seasonal", hidden: "seasonal", community: "seasonal",
};

/** The table's four statuses, from the manager's seven. */
const ENTITY: Record<MissionStatus, string> = {
  draft: "draft", scheduled: "draft", active: "active", paused: "inactive",
  completed: "inactive", expired: "inactive", archived: "archived",
};

function rewardsOf(v: unknown): Mission["rewards"] {
  const r = (v ?? {}) as Partial<Mission["rewards"]>;
  return { xp: Number(r.xp ?? 0), coins: Number(r.coins ?? 0), tokens: Number(r.tokens ?? 0), awardIds: r.awardIds ?? [] };
}

function missionFromRow(r: MissionRow, progress: { completed: number; taking: number }): Mission {
  const c = (r.conditions ?? {}) as {
    rules?: MissionRule[]; hidden?: boolean; amsType?: MissionType; slug?: string; department?: Mission["department"];
    activation?: Mission["activation"]; managementStatus?: MissionStatus;
  };
  const type = c.amsType ?? (r.cadence as MissionType);
  const status: MissionStatus =
    c.managementStatus ?? (r.status === "active" ? "active" : r.status === "archived" ? "archived" : "draft");
  return {
    id: r.id,
    slug: c.slug ?? slugify(r.name),
    name: r.name,
    description: r.description ?? "",
    type,
    status,
    department: c.department,
    hidden: c.hidden ?? type === "hidden",
    rules: c.rules ?? [],
    rewards: rewardsOf(r.rewards),
    activation: {
      repeatable: false,
      ...c.activation,
      startsAt: r.starts_at ?? c.activation?.startsAt,
      endsAt: r.ends_at ?? c.activation?.endsAt,
    },
    // Of the people taking part, how many have completed it.
    progress: { current: progress.completed, target: progress.taking },
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function missionToRow(m: Omit<Mission, "id" | "progress" | "createdAt" | "updatedAt">) {
  return {
    name: m.name,
    description: m.description,
    cadence: CADENCE[m.type],
    status: ENTITY[m.status],
    conditions: {
      rules: m.rules,
      hidden: m.hidden,
      amsType: m.type,
      slug: m.slug,
      department: m.department ?? null,
      activation: m.activation,
      managementStatus: m.status,
    },
    rewards: m.rewards,
    xp_reward: m.rewards.xp,
    starts_at: m.activation.startsAt ?? null,
    ends_at: m.activation.endsAt ?? null,
  };
}

type QuestRow = {
  id: string; name: string; description: string | null; steps: unknown; rewards: unknown;
  status: string; created_at: string; updated_at: string;
};

function questFromRow(r: QuestRow): QuestChain {
  const s = (r.steps && !Array.isArray(r.steps) ? r.steps : { stages: r.steps ?? [] }) as {
    stages?: QuestStage[]; mode?: QuestMode; season?: string; department?: QuestChain["department"];
    slug?: string; managementStatus?: MissionStatus;
  };
  return {
    id: r.id,
    slug: s.slug ?? slugify(r.name),
    name: r.name,
    description: r.description ?? "",
    mode: s.mode ?? "story",
    season: s.season,
    department: s.department,
    stages: withAvailability(s.stages ?? []),
    finaleRewards: rewardsOf(r.rewards),
    status: s.managementStatus ?? (r.status === "active" ? "active" : r.status === "archived" ? "archived" : "draft"),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * A stage is available when every stage it depends on comes before it, and
 * locked otherwise. Completion belongs to each person working through the
 * chain, and the platform keeps no per-person quest progress yet, so no stage
 * is shown as completed here.
 */
function withAvailability(stages: QuestStage[]): QuestStage[] {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  return sorted.map((s, i) => ({
    ...s,
    status: i === 0 && s.dependsOn.length === 0 ? "available" : "locked",
  }));
}

function questToRow(q: Omit<QuestChain, "id" | "createdAt" | "updatedAt">) {
  return {
    name: q.name,
    description: q.description,
    steps: {
      stages: q.stages.map(({ status: _status, ...stage }) => stage),
      mode: q.mode,
      season: q.season ?? null,
      department: q.department ?? null,
      slug: q.slug,
      managementStatus: q.status,
    },
    rewards: q.finaleRewards,
    xp_reward: q.finaleRewards.xp,
    status: ENTITY[q.status],
  };
}

/* ------------------------------- reads ------------------------------- */

export async function refreshMissions(): Promise<void> {
  try {
    const [missions, quests] = await Promise.all([
      table("missions").select("*").order("created_at", { ascending: false }),
      table("quests").select("*").order("created_at", { ascending: false }),
    ]);
    if (missions.error) throw new Error(missions.error.message);
    if (quests.error) throw new Error(quests.error.message);
    const rows = (missions.data ?? []) as MissionRow[];
    const progress = new Map<string, { completed: number; taking: number }>();
    for (let i = 0; i < rows.length; i += 200) {
      const ids = rows.slice(i, i + 200).map((r) => r.id);
      if (!ids.length) continue;
      const p = await table("user_mission_progress").select("mission_id,completed_at").in("mission_id", ids);
      if (p.error) throw new Error(p.error.message);
      for (const row of (p.data ?? []) as { mission_id: string; completed_at: string | null }[]) {
        const e = progress.get(row.mission_id) ?? { completed: 0, taking: 0 };
        e.taking += 1;
        if (row.completed_at) e.completed += 1;
        progress.set(row.mission_id, e);
      }
    }
    MISSIONS = rows.map((r) => missionFromRow(r, progress.get(r.id) ?? { completed: 0, taking: 0 }));
    QUESTS = ((quests.data ?? []) as QuestRow[]).map(questFromRow);
    loadError = null;
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  } finally {
    loaded = true;
    emit();
  }
}

export interface MissionDraft {
  name: string;
  description?: string;
  type: MissionType;
  status?: MissionStatus;
  department?: Mission["department"];
  hidden?: boolean;
  rules?: MissionRule[];
  rewards?: Partial<Mission["rewards"]>;
  activation?: Partial<Mission["activation"]>;
}

export function listMissions(filters: { type?: MissionType; status?: MissionStatus; search?: string } = {}): Mission[] {
  return MISSIONS.filter((m) => {
    if (filters.type && m.type !== filters.type) return false;
    if (filters.status && m.status !== filters.status) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!m.name.toLowerCase().includes(q) && !m.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export function getMission(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}

/* ------------------------------- writes ------------------------------ */

export async function createMission(d: MissionDraft): Promise<Mission> {
  const { data: auth } = await supabase.auth.getUser();
  const draft: Omit<Mission, "id" | "progress" | "createdAt" | "updatedAt"> = {
    slug: slugify(d.name) || uid(),
    name: d.name,
    description: d.description ?? "",
    type: d.type,
    status: d.status ?? "draft",
    department: d.department,
    hidden: d.hidden ?? d.type === "hidden",
    rules: d.rules ?? [],
    rewards: { xp: 0, coins: 0, tokens: 0, awardIds: [], ...d.rewards },
    activation: { repeatable: d.type === "daily" || d.type === "weekly" || d.type === "monthly", ...d.activation },
  };
  const { data, error } = await table("missions")
    .insert({ ...missionToRow(draft), created_by: auth.user?.id ?? null })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await refreshMissions();
  return missionFromRow(data as MissionRow, { completed: 0, taking: 0 });
}

export async function updateMission(id: string, patch: Partial<Mission>): Promise<Mission> {
  const current = getMission(id);
  if (!current) throw new Error("Mission not found");
  const next = { ...current, ...patch };
  const { error } = await table("missions")
    .update({ ...missionToRow(next), updated_at: now() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await refreshMissions();
  return getMission(id) ?? next;
}

/** A mission someone is already working on is archived, never deleted. */
export async function deleteMission(id: string): Promise<void> {
  const m = getMission(id);
  if (m && m.progress.target > 0) {
    throw new Error(`${m.progress.target} people are taking part in this mission, so it cannot be deleted. Archive it instead.`);
  }
  const { error } = await table("missions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await refreshMissions();
}

export function setMissionStatus(id: string, status: MissionStatus): Promise<Mission> {
  return updateMission(id, { status });
}

/* ============ Quest Chains ============ */
export interface QuestDraft {
  name: string;
  description?: string;
  mode: QuestMode;
  season?: string;
  department?: QuestChain["department"];
  stages?: Omit<QuestStage, "id" | "status">[];
  finaleRewards?: Partial<QuestChain["finaleRewards"]>;
}

export function listQuests(): QuestChain[] { return QUESTS; }
export function getQuest(id: string): QuestChain | undefined { return QUESTS.find((q) => q.id === id); }

export async function createQuest(d: QuestDraft): Promise<QuestChain> {
  const { data: auth } = await supabase.auth.getUser();
  const draft: Omit<QuestChain, "id" | "createdAt" | "updatedAt"> = {
    slug: slugify(d.name) || uid(),
    name: d.name,
    description: d.description ?? "",
    mode: d.mode,
    season: d.season,
    department: d.department,
    stages: withAvailability(
      (d.stages ?? []).map((s, i) => ({ ...s, id: uid(), order: s.order ?? i + 1, status: "locked" as const })),
    ),
    finaleRewards: { xp: 0, coins: 0, tokens: 0, awardIds: [], ...d.finaleRewards },
    status: "draft",
  };
  const { data, error } = await table("quests")
    .insert({ ...questToRow(draft), created_by: auth.user?.id ?? null })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await refreshMissions();
  return questFromRow(data as QuestRow);
}

export async function updateQuest(id: string, patch: Partial<QuestChain>): Promise<QuestChain> {
  const current = getQuest(id);
  if (!current) throw new Error("Quest not found");
  const next = { ...current, ...patch };
  const { error } = await table("quests").update({ ...questToRow(next), updated_at: now() }).eq("id", id);
  if (error) throw new Error(error.message);
  await refreshMissions();
  return getQuest(id) ?? next;
}

export async function deleteQuest(id: string): Promise<void> {
  const { error } = await table("quests").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await refreshMissions();
}

/** Add or change a stage. */
export async function upsertStage(
  questId: string,
  stage: Partial<QuestStage> & { id?: string; title: string },
): Promise<QuestChain> {
  const q = getQuest(questId);
  if (!q) throw new Error("Quest not found");
  const stages = [...q.stages];
  if (stage.id) {
    const i = stages.findIndex((s) => s.id === stage.id);
    if (i < 0) throw new Error("Stage not found");
    stages[i] = { ...stages[i], ...stage } as QuestStage;
  } else {
    stages.push({
      id: uid(),
      order: stage.order ?? stages.length + 1,
      title: stage.title,
      description: stage.description ?? "",
      missionIds: stage.missionIds ?? [],
      dependsOn: stage.dependsOn ?? [],
      rewards: { xp: 0, coins: 0, tokens: 0, awardIds: [], ...stage.rewards },
      status: "locked",
    });
  }
  return updateQuest(questId, { stages: withAvailability(stages) });
}

export async function removeStage(questId: string, stageId: string): Promise<QuestChain> {
  const q = getQuest(questId);
  if (!q) throw new Error("Quest not found");
  return updateQuest(questId, {
    stages: withAvailability(
      q.stages
        .filter((s) => s.id !== stageId)
        .map((s) => ({ ...s, dependsOn: s.dependsOn.filter((d) => d !== stageId) })),
    ),
  });
}
