// AMS Missions + Quests — in-memory API.
// Mirrors awards.api.ts. Completion flows through rewards.engine.grant().

import { grant } from "./rewards.engine";
import type {
  Mission, MissionRule, MissionStatus, MissionType,
  QuestChain, QuestMode, QuestStage,
} from "./missions.types";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
const now = () => new Date().toISOString();
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

let MISSIONS: Mission[] = [];
let QUESTS: QuestChain[] = [];

type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribeMissions(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; }
const emit = () => { missionsVersion++; for (const fn of listeners) fn(); };

// Stable snapshot for useSyncExternalStore — a fresh array on every read
// causes an infinite render loop.
let missionsVersion = 0;
let snapshotVersion = -1;
let snapshotValue: Mission[] = [];
export function missionsSnapshot(): Mission[] {
  if (snapshotVersion !== missionsVersion) {
    snapshotVersion = missionsVersion;
    snapshotValue = MISSIONS.slice();
  }
  return snapshotValue;
}
const EMPTY_MISSIONS: Mission[] = [];
export function missionsServerSnapshot(): Mission[] { return EMPTY_MISSIONS; }

/* ============ Missions ============ */
export interface MissionDraft {
  name: string;
  description?: string;
  type: MissionType;
  department?: Mission["department"];
  hidden?: boolean;
  rules?: MissionRule[];
  rewards?: Partial<Mission["rewards"]>;
  activation?: Partial<Mission["activation"]>;
  status?: MissionStatus;
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

export function createMission(d: MissionDraft): Mission {
  const target = d.rules?.[0]?.target ?? 1;
  const m: Mission = {
    id: uid(),
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
    progress: { current: 0, target },
    createdAt: now(),
    updatedAt: now(),
  };
  MISSIONS = [m, ...MISSIONS];
  emit();
  return m;
}

export function updateMission(id: string, patch: Partial<Mission>): Mission {
  const idx = MISSIONS.findIndex((m) => m.id === id);
  if (idx < 0) throw new Error("Mission not found");
  MISSIONS[idx] = { ...MISSIONS[idx], ...patch, updatedAt: now() };
  emit();
  return MISSIONS[idx];
}

export function deleteMission(id: string): void {
  MISSIONS = MISSIONS.filter((m) => m.id !== id);
  emit();
}

export function setMissionStatus(id: string, status: MissionStatus): Mission {
  return updateMission(id, { status });
}

/** Increment progress; auto-complete + grant when target reached. */
export function progressMission(id: string, delta = 1): Mission {
  const m = getMission(id);
  if (!m) throw new Error("Mission not found");
  const next = Math.min(m.progress.target, m.progress.current + delta);
  const updated = updateMission(id, { progress: { ...m.progress, current: next } });
  if (next >= m.progress.target && updated.status !== "completed") {
    return completeMission(id);
  }
  return updated;
}

export function completeMission(id: string): Mission {
  const m = getMission(id);
  if (!m) throw new Error("Mission not found");
  grant({
    xp: m.rewards.xp,
    coins: m.rewards.coins,
    tokens: m.rewards.tokens,
    awardIds: m.rewards.awardIds,
    reason: `mission:${m.slug}`,
  });
  return updateMission(id, {
    status: "completed",
    completedAt: now(),
    progress: { ...m.progress, current: m.progress.target },
  });
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

export function createQuest(d: QuestDraft): QuestChain {
  const stages: QuestStage[] = (d.stages ?? []).map((s, i) => ({
    ...s,
    id: uid(),
    order: s.order ?? i + 1,
    status: i === 0 && s.dependsOn.length === 0 ? "available" : "locked",
  }));
  const q: QuestChain = {
    id: uid(),
    slug: slugify(d.name) || uid(),
    name: d.name,
    description: d.description ?? "",
    mode: d.mode,
    season: d.season,
    department: d.department,
    stages,
    finaleRewards: { xp: 0, coins: 0, tokens: 0, awardIds: [], ...d.finaleRewards },
    status: "draft",
    createdAt: now(),
    updatedAt: now(),
  };
  QUESTS = [q, ...QUESTS];
  emit();
  return q;
}

export function updateQuest(id: string, patch: Partial<QuestChain>): QuestChain {
  const idx = QUESTS.findIndex((q) => q.id === id);
  if (idx < 0) throw new Error("Quest not found");
  QUESTS[idx] = { ...QUESTS[idx], ...patch, updatedAt: now() };
  emit();
  return QUESTS[idx];
}

export function deleteQuest(id: string) { QUESTS = QUESTS.filter((q) => q.id !== id); emit(); }

/** Add / reorder / remove a stage. */
export function upsertStage(questId: string, stage: Partial<QuestStage> & { id?: string; title: string }): QuestChain {
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
      status: (stage.order ?? stages.length + 1) === 1 ? "available" : "locked",
    });
  }
  stages.sort((a, b) => a.order - b.order);
  return updateQuest(questId, { stages });
}

export function removeStage(questId: string, stageId: string): QuestChain {
  const q = getQuest(questId);
  if (!q) throw new Error("Quest not found");
  return updateQuest(questId, { stages: q.stages.filter((s) => s.id !== stageId) });
}

/** Mark a stage complete; unlock dependents; grant rewards; finale if all done. */
export function completeStage(questId: string, stageId: string): QuestChain {
  const q = getQuest(questId);
  if (!q) throw new Error("Quest not found");
  const stages = q.stages.map((s) => (s.id === stageId ? { ...s, status: "completed" as const } : s));
  const completedIds = new Set(stages.filter((s) => s.status === "completed").map((s) => s.id));
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    if (s.status === "locked" && s.dependsOn.every((d) => completedIds.has(d))) {
      stages[i] = { ...s, status: "available" };
    }
  }
  const done = stages.find((s) => s.id === stageId);
  if (done) {
    grant({
      xp: done.rewards.xp, coins: done.rewards.coins, tokens: done.rewards.tokens,
      awardIds: done.rewards.awardIds, reason: `quest:${q.slug}:stage:${done.order}`,
    });
  }
  const allDone = stages.every((s) => s.status === "completed");
  if (allDone) {
    grant({
      xp: q.finaleRewards.xp, coins: q.finaleRewards.coins, tokens: q.finaleRewards.tokens,
      awardIds: q.finaleRewards.awardIds, reason: `quest:${q.slug}:finale`,
    });
  }
  return updateQuest(questId, { stages, status: allDone ? "completed" : q.status });
}
