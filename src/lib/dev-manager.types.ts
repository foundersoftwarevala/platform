/**
 * Shared (client-safe) DTO types for the Developer Manager delivery-governor
 * surfaces. These describe exactly what the server functions return.
 */

export type Availability = "available" | "busy" | "overloaded" | "offline";
export type UiPriority = "critical" | "high" | "medium" | "low";
export type UiStatus = "pending" | "in_progress" | "blocked" | "review";
export type RiskLevel = "critical" | "high" | "moderate";
export type EscalationStatus = "pending" | "acknowledged" | "resolved" | "rejected";

export interface DeveloperCapacityDTO {
  id: string;
  valaId: string;
  fullName: string;
  availability: Availability;
  activeTasks: number;
  maxCapacity: number;
  overdueCount: number;
  skillTags: string[];
}

export interface TaskDTO {
  id: string;
  code: string;
  title: string;
  developerId: string | null;
  assignedTo: string;
  priority: UiPriority;
  status: UiStatus;
  dueDate: string | null;
  slaHoursRemaining: number;
  promiseId: string | null;
}

export interface SLARiskDTO {
  taskId: string;
  code: string;
  title: string;
  assignee: string;
  promiseId: string | null;
  hoursRemaining: number;
  riskLevel: RiskLevel;
  escalatedAt: string | null;
}

export interface BlockedTaskDTO {
  taskId: string;
  code: string;
  title: string;
  assignee: string;
  blockedReason: string;
  blockedSince: string;
  blockedHours: number;
  autoEscalateThreshold: number;
  escalated: boolean;
}

export interface EscalationDTO {
  id: string;
  shortId: string;
  taskId: string;
  taskCode: string;
  reason: string;
  escalatedTo: string;
  escalatedAt: string;
  autoEscalated: boolean;
  status: EscalationStatus;
  resolvedAt: string | null;
  resolution: string | null;
}

export interface InternalNoteDTO {
  id: string;
  taskId: string;
  taskCode: string;
  author: string;
  content: string;
  timestamp: string;
}

export interface DeveloperPerformanceDTO {
  valaId: string;
  completedTasks: number;
  onTimeRate: number;
  avgCompletionTime: number;
  qualityScore: number;
  trend: "up" | "down" | "stable";
}

export interface DeliveryOverviewDTO {
  generatedAt: string;
  developers: DeveloperCapacityDTO[];
  tasks: TaskDTO[];
  risks: SLARiskDTO[];
  blocked: BlockedTaskDTO[];
  escalations: EscalationDTO[];
  notes: InternalNoteDTO[];
  performance: DeveloperPerformanceDTO[];
  taskOptions: { id: string; code: string; title: string }[];
  stats: {
    developers: number;
    activeTasks: number;
    atRisk: number;
    blocked: number;
    escalations: number;
  };
  autoEscalated: number;
}

export interface AuditEntryDTO {
  id: string;
  shortId: string;
  module: string;
  action: string;
  actor: string;
  target: string;
  timestamp: string;
  meta: string | null;
}

export interface AuditTrailDTO {
  entries: AuditEntryDTO[];
  total: number;
  page: number;
  pageSize: number;
}

/** Developer Registry row (live from the developers table). */
export interface RegistryDeveloperDTO {
  id: string;
  valaId: string;
  fullName: string;
  email: string;
  status: string;
  availability: Availability;
  skillTags: string[];
  maxCapacity: number;
  activeTasks: number;
  onboardingCompleted: boolean;
  joinedAt: string | null;
}
