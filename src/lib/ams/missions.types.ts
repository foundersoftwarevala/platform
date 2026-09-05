// AMS Missions + Quests — domain types.
import type { Department } from "./types";

export type MissionType =
  | "daily" | "weekly" | "monthly" | "yearly"
  | "department" | "hidden" | "community";

export const MISSION_TYPES: { value: MissionType; label: string; hint: string }[] = [
  { value: "daily",      label: "Daily",      hint: "Refreshes every 24h" },
  { value: "weekly",     label: "Weekly",     hint: "Refreshes every Monday" },
  { value: "monthly",    label: "Monthly",    hint: "Refreshes 1st of each month" },
  { value: "yearly",     label: "Yearly",     hint: "Annual challenge" },
  { value: "department", label: "Department", hint: "Scoped to a discipline" },
  { value: "hidden",     label: "Hidden",     hint: "Secret / discovered by action" },
  { value: "community",  label: "Community",  hint: "Global co-op goal" },
];

export type MissionStatus =
  | "draft" | "scheduled" | "active" | "paused"
  | "completed" | "expired" | "archived";

export interface MissionRule {
  id: string;
  metric: string;                // e.g. "sales.count", "logins.streak"
  operator: ">=" | ">" | "=" | "<" | "<=";
  target: number;
}

export interface MissionRewards {
  xp: number;
  coins: number;
  tokens: number;
  awardIds: string[];            // unlock these Awards on completion
}

export interface Mission {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: MissionType;
  status: MissionStatus;
  department?: Department;
  hidden: boolean;
  rules: MissionRule[];
  rewards: MissionRewards;
  activation: {
    startsAt?: string;           // ISO — when it becomes active
    endsAt?: string;             // ISO — when it expires
    cooldownHours?: number;      // for repeatable
    repeatable: boolean;
  };
  progress: { current: number; target: number };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/* =============================================================
 * QUESTS
 * ============================================================= */

export type QuestMode =
  | "story"        // narrative arc
  | "boss"         // heavy solo/team boss encounter
  | "elite"        // elevated difficulty
  | "season-pass"  // seasonal ladder
  | "xp-journey";  // xp-stage progression

export const QUEST_MODES: { value: QuestMode; label: string; hint: string; hue: string }[] = [
  { value: "story",       label: "Story Mode",   hint: "Narrative chapters",         hue: "#c084fc" },
  { value: "boss",        label: "Boss Mission", hint: "High-stakes finale",         hue: "#ef4444" },
  { value: "elite",       label: "Elite",        hint: "Hardened challenge",         hue: "#fb7185" },
  { value: "season-pass", label: "Season Pass",  hint: "Seasonal ladder / battle",   hue: "#fbbf24" },
  { value: "xp-journey",  label: "XP Journey",   hint: "Level up through stages",    hue: "#22d3ee" },
];

export type QuestStageStatus = "locked" | "available" | "in-progress" | "completed";

export interface QuestStage {
  id: string;
  order: number;                 // 1..N — display + dependency ordering
  title: string;
  description: string;
  missionIds: string[];          // missions that must complete for this stage
  dependsOn: string[];           // stage ids that must complete first
  rewards: MissionRewards;
  status: QuestStageStatus;
}

export interface QuestChain {
  id: string;
  slug: string;
  name: string;
  description: string;
  mode: QuestMode;
  season?: string;               // e.g. "Season 3 — Winter Ascendant"
  department?: Department;
  stages: QuestStage[];
  finaleRewards: MissionRewards; // granted when all stages complete
  status: MissionStatus;
  createdAt: string;
  updatedAt: string;
}
