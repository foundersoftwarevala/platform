export type TaskPromiseStatus = "pending" | "fulfilled" | "broken";

export interface TaskPromiseDTO {
  id: string;
  taskId: string;
  taskTitle: string;
  developerId: string;
  status: TaskPromiseStatus;
  promisedAt: string;
  deadlineAt: string;
  finePercentage: string | null;
  fineAmount: string | null;
  fineCents: string;
  fineAppliedAt: string | null;
  note: string | null;
  breakReason: string | null;
}

export interface PromiseEligibleTaskDTO {
  id: string;
  title: string;
  status: string;
}

export interface DeveloperTaskPromisesDTO {
  tasks: PromiseEligibleTaskDTO[];
  promises: TaskPromiseDTO[];
}

export interface ManagedTaskPromiseDTO extends TaskPromiseDTO {
  taskStatus: string;
}
