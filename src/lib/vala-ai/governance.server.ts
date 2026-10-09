import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { audit } from "./audit.server.ts";
import type { Operator } from "./auth.server.ts";
import { paths } from "./config.server.ts";
import { all, one, run } from "./db.server.ts";
import { getProject } from "./projects.server.ts";
import { ACTIVE, getTask, verificationOf } from "./tasks.server.ts";
import { newId, now, parseJson, sha256, ValaError } from "./util.server.ts";
import {
  commitExists,
  headCommit,
  isClean,
  patchBetween,
  requireReadyWorkspace,
  resetWorkspace,
} from "./workspace.server.ts";

/**
 * Approvals and releases.
 *
 * Restricted actions — rolling a workspace back, cutting a release — are
 * requested, then decided by an owner, then executed by the server, and the
 * record keeps who asked, who decided, the exact scope, the evidence the
 * decider was shown, and what actually happened. A release can only be cut
 * from a task whose verification is VERIFIED, and once written it cannot be
 * changed (enforced by database triggers).
 */

export type ApprovalKind = "workspace.rollback" | "release.create";
export type Approval = {
  id: string;
  kind: ApprovalKind;
  project_id: string | null;
  target_id: string;
  scope_json: string;
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
  requested_by: string;
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
  patch_path: string;
  patch_sha256: string;
  evidence_ids: string;
  approval_id: string;
  created_by: string;
  created_at: string;
};

export function listApprovals(status?: string): Approval[] {
  return status
    ? all<Approval>(
        "select * from approvals where status = ? order by requested_at desc limit 300",
        status,
      )
    : all<Approval>("select * from approvals order by requested_at desc limit 300");
}

function getApproval(id: string): Approval {
  const a = one<Approval>("select * from approvals where id = ?", id);
  if (!a) throw new ValaError(404, "Approval not found.");
  return a;
}

function hasActiveTask(projectId: string) {
  return Boolean(
    one(
      `select 1 from tasks where project_id = ? and state in (${ACTIVE.map(() => "?").join(",")})`,
      projectId,
      ...ACTIVE,
    ),
  );
}

export function requestRollback(
  projectId: string,
  commit: string,
  reason: string,
  actor: Operator,
): Approval {
  getProject(projectId);
  const ws = requireReadyWorkspace(projectId);
  if (!commitExists(ws, commit)) throw new ValaError(400, "That commit is not in this workspace.");
  if (!reason?.trim()) throw new ValaError(400, "Give a reason for the rollback.");
  return createApproval(
    "workspace.rollback",
    projectId,
    commit,
    { projectId, commit, from: headCommit(ws), reason: reason.trim() },
    actor,
  );
}

export function requestRelease(taskId: string, label: string, actor: Operator): Approval {
  const task = getTask(taskId);
  if (task.state !== "COMPLETE") throw new ValaError(409, "Only a COMPLETE task can be released.");
  const v = verificationOf(task);
  if (v.status !== "VERIFIED" || !v.commit)
    throw new ValaError(
      409,
      `Task verification is ${v.status}; an unverified result cannot be released.`,
    );
  if (!label?.trim() || label.length > 60)
    throw new ValaError(400, "A release label (max 60 characters) is required.");
  if (
    one("select 1 from releases where project_id = ? and label = ?", task.project_id, label.trim())
  )
    throw new ValaError(409, "A release with this label already exists.");
  return createApproval(
    "release.create",
    task.project_id,
    taskId,
    {
      taskId,
      label: label.trim(),
      commit: v.commit,
      evidence: v.checks.map((c) => c.evidence?.id),
    },
    actor,
  );
}

function createApproval(
  kind: ApprovalKind,
  projectId: string | null,
  targetId: string,
  scope: Record<string, unknown>,
  actor: Operator,
): Approval {
  if (
    one(
      "select 1 from approvals where kind = ? and target_id = ? and status = 'pending'",
      kind,
      targetId,
    )
  )
    throw new ValaError(409, "An identical request is already waiting for a decision.");
  const id = newId("AP", 8);
  run(
    "insert into approvals (id, kind, project_id, target_id, scope_json, status, requested_by, requested_at) values (?,?,?,?,?,?,?,?)",
    id,
    kind,
    projectId,
    targetId,
    JSON.stringify(scope),
    "pending",
    actor.id,
    now(),
  );
  audit(actor.id, "approval.request", "approval", id, { kind, targetId, scope });
  return getApproval(id);
}

/** Owner only (checked by the caller). Executes on approval and records the real outcome. */
export function decideApproval(
  id: string,
  input: { approve: boolean; note?: string; evidenceReviewed?: string[] },
  actor: Operator,
): Approval {
  const a = getApproval(id);
  if (a.status !== "pending") throw new ValaError(409, `Approval is already ${a.status}.`);
  const note = input.note?.trim() || null;
  const reviewed = JSON.stringify(input.evidenceReviewed ?? []);
  if (!input.approve) {
    run(
      "update approvals set status = 'rejected', decided_by = ?, decided_at = ?, decision_note = ?, evidence_reviewed = ? where id = ?",
      actor.id,
      now(),
      note,
      reviewed,
      id,
    );
    audit(actor.id, "approval.reject", "approval", id, { kind: a.kind });
    return getApproval(id);
  }
  run(
    "update approvals set status = 'approved', decided_by = ?, decided_at = ?, decision_note = ?, evidence_reviewed = ? where id = ?",
    actor.id,
    now(),
    note,
    reviewed,
    id,
  );
  audit(actor.id, "approval.approve", "approval", id, { kind: a.kind });
  let outcome: string;
  let status: Approval["status"] = "executed";
  try {
    outcome =
      a.kind === "workspace.rollback" ? executeRollback(a, actor) : executeRelease(a, actor);
  } catch (e) {
    status = "failed";
    outcome = (e as Error).message;
  }
  run("update approvals set status = ?, outcome = ? where id = ?", status, outcome, id);
  audit(
    actor.id,
    status === "executed" ? "approval.executed" : "approval.execution_failed",
    "approval",
    id,
    { kind: a.kind, outcome },
  );
  return getApproval(id);
}

function executeRollback(a: Approval, actor: Operator): string {
  const scope = parseJson<{ projectId: string; commit: string }>(a.scope_json, {
    projectId: "",
    commit: "",
  });
  if (hasActiveTask(scope.projectId))
    throw new ValaError(
      409,
      "A task is running in this project; cancel it or let it finish first.",
    );
  const ws = requireReadyWorkspace(scope.projectId);
  resetWorkspace(ws, scope.commit);
  // Verify the restore rather than trusting the command's exit status.
  const head = headCommit(ws);
  const clean = isClean(ws);
  if (head !== scope.commit || !clean)
    throw new ValaError(500, `Rollback did not verify: HEAD ${head.slice(0, 10)}, clean=${clean}.`);
  audit(actor.id, "workspace.rollback", "workspace", ws.id, { to: scope.commit });
  return `Workspace restored to ${scope.commit.slice(0, 10)}; verified HEAD matches and the tree is clean.`;
}

function executeRelease(a: Approval, actor: Operator): string {
  const scope = parseJson<{ taskId: string; label: string; commit: string }>(a.scope_json, {
    taskId: "",
    label: "",
    commit: "",
  });
  const task = getTask(scope.taskId);
  const v = verificationOf(task);
  if (v.status !== "VERIFIED" || v.commit !== scope.commit)
    throw new ValaError(409, "Verification changed since the request; release refused.");
  const ws = requireReadyWorkspace(task.project_id);
  if (!commitExists(ws, scope.commit))
    throw new ValaError(409, "The verified commit is no longer in the workspace.");
  const previous = one<{ commit_sha: string }>(
    "select commit_sha from releases where project_id = ? order by created_at desc limit 1",
    task.project_id,
  );
  const base = previous?.commit_sha ?? ws.base_commit ?? scope.commit;
  const patch = patchBetween(ws, base, scope.commit);
  const id = newId("REL", 8);
  const dir = resolve(paths.releases(), task.project_id);
  mkdirSync(dir, { recursive: true });
  const patchPath = resolve(dir, `${id}.patch`);
  writeFileSync(patchPath, patch, "utf8");
  run(
    "insert into releases (id, project_id, task_id, label, base_commit, commit_sha, patch_path, patch_sha256, evidence_ids, approval_id, created_by, created_at) values (?,?,?,?,?,?,?,?,?,?,?,?)",
    id,
    task.project_id,
    task.id,
    scope.label,
    base,
    scope.commit,
    patchPath,
    sha256(patch),
    JSON.stringify(v.checks.map((c) => c.evidence?.id)),
    a.id,
    actor.id,
    now(),
  );
  audit(actor.id, "release.create", "release", id, {
    label: scope.label,
    commit: scope.commit,
    base,
    patchSha256: sha256(patch),
  });
  return `Release ${id} "${scope.label}" recorded at ${scope.commit.slice(0, 10)} (patch ${patch.length} bytes, sha256 ${sha256(patch).slice(0, 12)}…).`;
}

export function listReleases(projectId?: string): Release[] {
  return projectId
    ? all<Release>(
        "select * from releases where project_id = ? order by created_at desc",
        projectId,
      )
    : all<Release>("select * from releases order by created_at desc limit 200");
}

export function getRelease(id: string): Release {
  const r = one<Release>("select * from releases where id = ?", id);
  if (!r) throw new ValaError(404, "Release not found.");
  return r;
}
