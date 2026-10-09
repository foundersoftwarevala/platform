import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { authHeaders } from "@/lib/auth/operator-fetch";

/**
 * Client for /api/vala-ai. Every call carries the Control Panel session's
 * bearer token; every response is real server state.
 */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = init.method ?? "GET";
  const res = await fetch(`/api/vala-ai${path}`, {
    method,
    headers: {
      ...(await authHeaders()),
      ...(method === "GET" ? {} : { "content-type": "application/json" }),
    },
    body: method === "GET" ? undefined : JSON.stringify(init.body ?? {}),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok)
    throw new ApiError(res.status, data?.error ?? `Request failed (HTTP ${res.status}).`);
  return data as T;
}

/** Downloads a file endpoint with the session token and hands it to the browser. */
export async function download(path: string, filename: string) {
  const res = await fetch(`/api/vala-ai${path}`, { headers: await authHeaders() });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, data?.error ?? `Download failed (HTTP ${res.status}).`);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useApi<T>(
  key: unknown[],
  path: string | null,
  opts: Partial<UseQueryOptions<T, ApiError>> = {},
) {
  return useQuery<T, ApiError>({
    queryKey: ["vala", ...key],
    queryFn: () => api<T>(path!),
    enabled: path !== null,
    retry: false,
    ...opts,
  });
}

export function useAction<TBody, TOut = unknown>(
  fn: (body: TBody) => Promise<TOut>,
  invalidate: unknown[][] = [["vala"]],
) {
  const qc = useQueryClient();
  return useMutation<TOut, ApiError, TBody>({
    mutationFn: fn,
    onSettled: () => {
      for (const key of invalidate) void qc.invalidateQueries({ queryKey: key });
    },
  });
}

// ---- types mirrored from the server ---------------------------------------
export type Role = "owner" | "operator" | "viewer";
export type Operator = {
  id: string;
  email: string;
  name: string;
  role: Role;
};
export type TaskState =
  | "PENDING"
  | "ANALYZING"
  | "BUILDING"
  | "TESTING"
  | "FIXING"
  | "RETESTING"
  | "VERIFIED"
  | "COMPLETE"
  | "BLOCKED"
  | "FAILED"
  | "CANCELLED";
export const TASK_STATES: TaskState[] = [
  "PENDING",
  "ANALYZING",
  "BUILDING",
  "TESTING",
  "FIXING",
  "RETESTING",
  "VERIFIED",
  "COMPLETE",
  "BLOCKED",
  "FAILED",
  "CANCELLED",
];
export const ACTIVE_STATES: TaskState[] = [
  "PENDING",
  "ANALYZING",
  "BUILDING",
  "TESTING",
  "FIXING",
  "RETESTING",
  "VERIFIED",
];
export type AcceptanceCheck = { id: string; label: string; command: string };
export type Project = {
  id: string;
  name: string;
  description: string;
  source_kind: "git" | "empty";
  source_path: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  open_tasks?: number;
  approved_version?: number | null;
};
export type Workspace = {
  id: string;
  project_id: string;
  path: string;
  base_commit: string | null;
  status: "creating" | "ready" | "failed";
  error: string | null;
  created_at: string;
};
export type Requirement = {
  id: string;
  project_id: string;
  version: number;
  title: string;
  body: string;
  acceptance_checks: string;
  status: "draft" | "approved" | "superseded";
  created_by: string;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
};
export type ChangeRequest = {
  id: string;
  project_id: string;
  requirement_id: string;
  reason: string;
  proposed_title: string;
  proposed_body: string;
  proposed_checks: string;
  status: "open" | "approved" | "rejected";
  raised_by: string;
  raised_by_label?: string | null;
  decided_by_label?: string | null;
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
};
export type Task = {
  id: string;
  project_id: string;
  project_name?: string;
  requirement_id: string;
  title: string;
  instruction: string;
  state: TaskState;
  fix_loops: number;
  max_fix_loops: number;
  lease_owner: string | null;
  lease_until: string | null;
  cancel_requested: number;
  blocked_reason: string | null;
  error: string | null;
  plan_json: string | null;
  result_summary: string | null;
  start_commit: string | null;
  bytes_written: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};
export type TaskEvent = {
  id: number;
  task_id: string;
  at: string;
  kind: string;
  from_state: string | null;
  to_state: string | null;
  message: string;
  data_json: string | null;
};
export type Evidence = {
  id: string;
  task_id: string | null;
  project_id: string;
  check_id: string | null;
  label: string;
  command: string;
  commit_sha: string | null;
  exit_code: number | null;
  timed_out: number;
  duration_ms: number;
  output_sha256: string;
  output_tail: string;
  producer: "agent" | "verifier";
  verdict: "pass" | "fail" | "unknown";
  sandbox?: string;
  created_at: string;
};
export type Verification = {
  status: "VERIFIED" | "FAILED" | "UNKNOWN";
  commit: string | null;
  checks: { check: AcceptanceCheck; evidence: Evidence | null }[];
};
export type Checkpoint = {
  id: string;
  task_id: string | null;
  project_id: string;
  label: string;
  commit_sha: string;
  created_at: string;
};
export type Approval = {
  id: string;
  kind: "workspace.rollback" | "release.create";
  project_id: string | null;
  target_id: string;
  scope_json: string;
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
  requested_by: string;
  requested_by_label?: string | null;
  decided_by_label?: string | null;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  evidence_reviewed: string | null;
  outcome: string | null;
};
export type Release = {
  id: string;
  project_id: string;
  task_id: string;
  label: string;
  base_commit: string;
  commit_sha: string;
  patch_sha256: string;
  evidence_ids: string;
  approval_id: string;
  created_by: string;
  created_at: string;
};
export type ChatRow = {
  id: string;
  project_id: string | null;
  operator_id: string;
  role: "user" | "assistant" | "error";
  content: string;
  model: string | null;
  duration_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
};
export type AuditEntry = {
  seq: number;
  at: string;
  actor: string;
  actor_label?: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail_json: string;
  hash: string;
};
export type Settings = {
  model_url: string;
  model_timeout_s: number;
  model_max_tokens: number;
  command_timeout_s: number;
  max_output_kb: number;
  max_fix_loops: number;
  max_task_write_kb: number;
  max_file_kb: number;
  min_free_disk_gb: number;
  min_free_mem_mb: number;
  chat_per_minute: number;
  tasks_per_minute: number;
  model_source: "local" | "ai-api-manager";
  gateway_service: string;
};
export type GatewayServices = {
  available: boolean;
  services: { id: string; name: string; provider: string; model: string | null }[];
  error: string | null;
};
export type Status = {
  model: {
    online: boolean;
    source: "local" | "ai-api-manager";
    service: string | null;
    url: string;
    model: string | null;
    error: string | null;
    checkedAt: string;
  };
  worker: {
    running: boolean;
    owner: string;
    busyTask: string | null;
    startedAt: string;
    lastTick: string | null;
    lastError: string | null;
  };
  resources: {
    freeDiskGb: number;
    totalDiskGb: number;
    freeMemMb: number;
    totalMemMb: number;
    cpuCount: number;
    load1: number | null;
    ok: boolean;
    problems: string[];
  };
  schemaVersion: number;
  dataDir: string;
  audit: { ok: boolean; entries: number; brokenAt: number | null };
  tasksByState: Record<TaskState, number>;
  projects: number;
  pendingApprovals: number;
  sandbox: { mode: string; image: string | null; ready: boolean; problem: string | null };
  openChangeRequests: number;
  capabilities: { area: string; status: "built" | "not built"; note?: string }[];
};
export type ProjectDetail = {
  project: Project;
  workspace: Workspace | null;
  requirements: Requirement[];
  changeRequests: ChangeRequest[];
  tasks: Task[];
  checkpoints: Checkpoint[];
  releases: Release[];
  uncommitted: { status: string; path: string }[];
};
export type TaskDetail = {
  task: Task;
  project: Project;
  events: TaskEvent[];
  evidence: Evidence[];
  verification: Verification;
};

export function parseList<T>(text: string | null | undefined): T[] {
  try {
    const v = JSON.parse(text ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
