import type { Json } from "@/lib/json";

export type TaskStatus =
  | "assigned"
  | "in_progress"
  | "submitted"
  | "rejected"
  | "verified"
  | "paid"
  | "cancelled";

export type TaskPaymentStatus = "pending" | "verified" | "due" | "paid";

export interface CanonicalTaskAssigneeDTO {
  userId: string;
  label: string;
}

export interface CanonicalTaskDTO {
  id: string;
  developerId: string;
  developerRecordId: string | null;
  developerLabel: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  paymentStatus: TaskPaymentStatus;
  dueAt: string | null;
  deadlineAt: string | null;
  verifiedAt: string | null;
  paidAt: string | null;
  priority: string | null;
  artifacts: Json | null;
  submissionNotes: string | null;
  managerNotes: string | null;
  createdAt: string;
  updatedAt: string;
}
