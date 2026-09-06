import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type TMMember = Tables<"tm_members">;
export type TMTask = Tables<"tm_tasks">;
export type TMSubtask = Tables<"tm_subtasks">;
export type TMComment = Tables<"tm_comments">;
export type TMAttachment = Tables<"tm_attachments">;
export type TMDependency = Tables<"tm_dependencies">;
export type TMApproval = Tables<"tm_approvals">;
export type TMReview = Tables<"tm_reviews">;
export type TMTimeLog = Tables<"tm_time_logs">;
export type TMEscalation = Tables<"tm_escalations">;
export type TMAutomation = Tables<"tm_automations">;
export type TMNotification = Tables<"tm_notifications">;
export type TMActivity = Tables<"tm_activity">;
export type TMSettings = Tables<"tm_settings">;

export type TMTaskInsert = TablesInsert<"tm_tasks">;
export type TMTaskUpdate = TablesUpdate<"tm_tasks">;
export type TMSettingsUpdate = TablesUpdate<"tm_settings">;
export type TMAutomationInsert = TablesInsert<"tm_automations">;

export type TMTaskStatus = TMTask["status"];
export type TMTaskPriority = TMTask["priority"];

export type TMPerson = Pick<TMMember, "id" | "full_name" | "role" | "email">;

/** A task joined with the member records it points at. */
export type TMTaskWithPeople = TMTask & {
  assignee: TMPerson | null;
  creator: TMPerson | null;
};

export type TMTaskDetail = TMTaskWithPeople & {
  subtasks: TMSubtask[];
  comments: TMComment[];
  attachments: TMAttachment[];
  approvals: TMApproval[];
  reviews: TMReview[];
  time_logs: TMTimeLog[];
  escalations: TMEscalation[];
};

export const TM_STATUSES: TMTaskStatus[] = [
  "new",
  "assigned",
  "accepted",
  "in_progress",
  "ai_review",
  "waiting_client",
  "testing",
  "blocked",
  "on_hold",
  "completed",
  "cancelled",
];

export const TM_PRIORITIES: TMTaskPriority[] = ["low", "medium", "high", "critical"];

export const TM_ACTIVE_STATUSES: TMTaskStatus[] = [
  "new",
  "assigned",
  "accepted",
  "in_progress",
  "ai_review",
  "waiting_client",
  "testing",
  "blocked",
  "on_hold",
];

export const TM_CATEGORIES = [
  "development",
  "bugfix",
  "integration",
  "design",
  "devops",
  "qa",
  "security",
  "compliance",
  "automation",
  "support",
] as const;

export const TM_DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;