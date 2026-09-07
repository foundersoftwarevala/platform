import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Author Approval Workflow.
 *
 * The submission is a workflow record over the canonical product and seller —
 * Author Manager stays the source of truth for the author, Product Manager for
 * the product, Legal Manager for anything legal. Nothing is copied here.
 *
 * Two rules are enforced in the database rather than in this file, because a
 * client cannot be trusted with either: an approval is refused outright while
 * any mandatory check is failing, and a transition carrying a stale lock
 * version is refused rather than overwriting another reviewer's decision.
 */

async function callAsUser<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");

  const { createClient } = await import("@supabase/supabase-js");
  const base = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const client = createClient(base, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export type SubmissionStatus =
  | "draft" | "pending_review" | "verifying" | "changes_requested"
  | "approved" | "rejected" | "suspended" | "archived";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type SubmissionRow = {
  id: string;
  submission_no: string;
  product_id: string;
  product: string | null;
  seller_id: string | null;
  author: string | null;
  type: "new" | "update";
  status: SubmissionStatus;
  revision: number;
  risk_score: number;
  risk_level: RiskLevel;
  risk_reasons: { factor: string; weight: number; evidence: string; source: string }[];
  reviewer_id: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  sla_due_at: string | null;
  escalate_at: string | null;
  escalated_at: string | null;
  sla_state: "n/a" | "on_track" | "due_soon" | "overdue" | "breached";
  last_action: string | null;
  last_reason: string | null;
  /** Send this back with a transition. A mismatch means someone else acted. */
  lock_version: number;
  history: number;
};

export type ApprovalRule = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  config: Record<string, unknown>;
};

export type TrustedAuthor = {
  seller_id: string;
  name: string;
  kind: string | null;
  status: string;
  approved: number;
  rejected: number;
  violations: number;
  last_review: string | null;
  trust_level: "untrusted" | "flagged" | "trusted" | "known" | "new";
};

export type SubmissionQueue = {
  ok: boolean;
  reason?: string;
  counts?: Record<SubmissionStatus, number>;
  sla?: {
    response_hours: number; escalate_hours: number; stale_draft_days: number;
    breached: number; due_soon: number;
  };
  rules?: ApprovalRule[];
  trusted_authors?: TrustedAuthor[];
  total?: number;
  submissions?: SubmissionRow[];
};

const status = z.enum([
  "draft", "pending_review", "verifying", "changes_requested",
  "approved", "rejected", "suspended", "archived",
]);

export const getSubmissions = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({
      status: status.optional(),
      search: z.string().max(120).optional(),
      risk: z.enum(["low", "medium", "high", "critical"]).optional(),
      type: z.enum(["new", "update"]).optional(),
      sort: z.enum(["newest", "oldest", "risk", "sla"]).optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<SubmissionQueue> =>
    callAsUser("mm_submissions", { p_query: data }),
  );

/** The whole review packet: product, author, checks, risk, evidence, history. */
export const getSubmissionDetail = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_submission_detail", { p_id: data.id }),
  );

export const createSubmission = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      product_id: z.string().uuid(),
      type: z.enum(["new", "update"]).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; message?: string }> =>
    callAsUser("mm_submission_create", {
      p_product: data.product_id, p_type: data.type ?? "new", p_version: null,
    }),
  );

/**
 * Move a submission.
 *
 * `lock` is the lock_version read with the row. If another reviewer has acted
 * since, the call is refused with reason "stale" and nothing changes.
 */
export const transitionSubmission = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status,
      reason: z.string().max(1000).optional(),
      comment: z.string().max(2000).optional(),
      lock: z.number().int().optional(),
      override: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string;
    submission?: SubmissionRow; published?: boolean;
    checks?: unknown[]; current_status?: string; current_lock?: number;
  }> => callAsUser("mm_submission_transition", {
    p_id: data.id, p_to: data.status,
    p_reason: data.reason ?? null, p_lock: data.lock ?? null,
    p_comment: data.comment ?? null, p_override: data.override ?? false,
  }));

/** Bulk, with each submission validated on its own. Nothing is waved through. */
export const bulkTransition = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(100),
      status,
      reason: z.string().max(1000).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; applied?: number; skipped?: number;
    results?: { id: string; ok: boolean; reason?: string; message?: string }[];
  }> => callAsUser("mm_submissions_bulk", {
    p_ids: data.ids, p_to: data.status, p_reason: data.reason ?? null,
  }));

export const addEvidence = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      submission_id: z.string().uuid(),
      kind: z.enum([
        "screenshot", "document", "package", "url", "verification", "legal", "security", "note",
      ]),
      label: z.string().min(1).max(200),
      url: z.string().max(2000).optional(),
      detail: z.string().max(2000).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; message?: string }> =>
    callAsUser("mm_submission_evidence_add", {
      p_submission: data.submission_id, p_kind: data.kind, p_label: data.label,
      p_url: data.url ?? null, p_detail: data.detail ?? null,
    }),
  );

export const setApprovalRule = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      key: z.string().max(60),
      enabled: z.boolean().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
      reason: z.string().max(300).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> => {
    const { key, ...patch } = data;
    return callAsUser("mm_approval_rule_set", { p_key: key, p_patch: patch });
  });

export const setApprovalSla = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      response_hours: z.number().int().min(1).max(720).optional(),
      escalate_hours: z.number().int().min(1).max(2160).optional(),
      stale_draft_days: z.number().int().min(1).max(365).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> =>
    callAsUser("mm_approval_sla_set", { p_patch: data }),
  );

/** Find and escalate SLA breaches, from the submissions' own timestamps. */
export const runSlaSweep = createServerFn({ method: "POST" }).handler(
  async (): Promise<{
    ok: boolean; reason?: string; due_soon?: number; escalated?: number;
    stale_drafts?: number; note?: string;
  }> => callAsUser("mm_approval_sla_run", {}),
);
