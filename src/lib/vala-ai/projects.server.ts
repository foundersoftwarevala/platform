import { audit } from "./audit.server.ts";
import type { Operator } from "./auth.server.ts";
import { all, one, run, tx } from "./db.server.ts";
import { parseCommand } from "./exec.server.ts";
import { createWorkspace, getWorkspace, inspectSource } from "./workspace.server.ts";
import { newId, now, parseJson, ValaError } from "./util.server.ts";

/**
 * Projects, their requirements, and the scope lock.
 *
 * A project's id (`VP-…`) is issued once and never changes. Requirements are
 * versioned: a draft can be edited; once an owner approves it, it is the
 * contract the agent builds against and it cannot be edited. Changing approved
 * scope goes through a change request that an owner approves, which produces a
 * new approved version and supersedes the old one — nothing changes silently.
 */

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
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
};

export function normaliseChecks(input: unknown): AcceptanceCheck[] {
  if (!Array.isArray(input)) throw new ValaError(400, "Acceptance checks must be a list.");
  if (input.length > 20) throw new ValaError(400, "At most 20 acceptance checks.");
  return input.map((raw, i) => {
    const c = raw as Partial<AcceptanceCheck>;
    const label = String(c.label ?? "").trim();
    const command = String(c.command ?? "").trim();
    if (!label) throw new ValaError(400, `Check ${i + 1} needs a label.`);
    parseCommand(command);
    return { id: `C${i + 1}`, label: label.slice(0, 200), command };
  });
}

export function listProjects(): (Project & {
  open_tasks: number;
  approved_version: number | null;
})[] {
  return all(
    `select p.*,
       (select count(*) from tasks t where t.project_id = p.id and t.state not in ('COMPLETE','FAILED','CANCELLED')) as open_tasks,
       (select max(version) from requirements r where r.project_id = p.id and r.status = 'approved') as approved_version
     from projects p order by p.updated_at desc`,
  );
}

export function getProject(id: string): Project {
  const p = one<Project>("select * from projects where id = ?", id);
  if (!p) throw new ValaError(404, `Project ${id} not found.`);
  return p;
}

export function createProject(
  input: {
    name: string;
    description?: string;
    sourceKind: "git" | "empty";
    sourcePath?: string | null;
  },
  actor: Operator,
) {
  const name = input.name?.trim();
  if (!name || name.length > 120)
    throw new ValaError(400, "Project name is required (max 120 characters).");
  if (input.sourceKind !== "git" && input.sourceKind !== "empty")
    throw new ValaError(400, "Source must be an existing git repository or an empty project.");
  const sourcePath =
    input.sourceKind === "git" ? inspectSource(String(input.sourcePath ?? "")).root : null;
  const id = newId("VP", 8);
  run(
    "insert into projects (id, name, description, source_kind, source_path, created_by, created_at, updated_at) values (?,?,?,?,?,?,?,?)",
    id,
    name,
    (input.description ?? "").trim().slice(0, 4000),
    input.sourceKind,
    sourcePath,
    actor.id,
    now(),
    now(),
  );
  audit(actor.id, "project.create", "project", id, {
    name,
    sourceKind: input.sourceKind,
    sourcePath,
  });
  let workspaceError: string | null = null;
  try {
    createWorkspace(id, { kind: input.sourceKind, path: sourcePath }, actor.id);
  } catch (e) {
    workspaceError = (e as Error).message;
  }
  return { project: getProject(id), workspace: getWorkspace(id) ?? null, workspaceError };
}

export function retryWorkspace(projectId: string, actor: Operator) {
  const p = getProject(projectId);
  const ws = getWorkspace(projectId);
  if (ws && ws.status !== "failed") throw new ValaError(409, `Workspace is ${ws.status}.`);
  if (ws) run("delete from workspaces where id = ?", ws.id);
  return createWorkspace(projectId, { kind: p.source_kind, path: p.source_path }, actor.id);
}

export function listRequirements(projectId: string): Requirement[] {
  return all<Requirement>(
    "select * from requirements where project_id = ? order by version desc",
    projectId,
  );
}

export function getRequirement(id: string): Requirement {
  const r = one<Requirement>("select * from requirements where id = ?", id);
  if (!r) throw new ValaError(404, "Requirement not found.");
  return r;
}

export function approvedRequirement(projectId: string): Requirement | undefined {
  return one<Requirement>(
    "select * from requirements where project_id = ? and status = 'approved' order by version desc limit 1",
    projectId,
  );
}

export function checksOf(r: Pick<Requirement, "acceptance_checks">): AcceptanceCheck[] {
  return parseJson<AcceptanceCheck[]>(r.acceptance_checks, []);
}

export function saveDraft(
  projectId: string,
  input: { requirementId?: string; title: string; body: string; checks: unknown },
  actor: Operator,
): Requirement {
  getProject(projectId);
  const title = input.title?.trim();
  const body = input.body?.trim();
  if (!title || !body) throw new ValaError(400, "Title and requirement text are required.");
  const checks = normaliseChecks(input.checks);
  if (input.requirementId) {
    const existing = getRequirement(input.requirementId);
    if (existing.project_id !== projectId)
      throw new ValaError(400, "Requirement belongs to another project.");
    if (existing.status !== "draft")
      throw new ValaError(409, "Approved requirements are locked. Raise a change request instead.");
    run(
      "update requirements set title = ?, body = ?, acceptance_checks = ? where id = ?",
      title,
      body,
      JSON.stringify(checks),
      existing.id,
    );
    audit(actor.id, "requirement.edit_draft", "requirement", existing.id, { projectId });
    return getRequirement(existing.id);
  }
  if (one("select 1 from requirements where project_id = ? and status = 'draft'", projectId))
    throw new ValaError(409, "This project already has a draft. Edit it instead.");
  const version =
    Number(
      one<{ v: number }>(
        "select coalesce(max(version), 0) as v from requirements where project_id = ?",
        projectId,
      )?.v ?? 0,
    ) + 1;
  const id = newId("RQ", 8);
  run(
    "insert into requirements (id, project_id, version, title, body, acceptance_checks, status, created_by, created_at) values (?,?,?,?,?,?,?,?,?)",
    id,
    projectId,
    version,
    title,
    body,
    JSON.stringify(checks),
    "draft",
    actor.id,
    now(),
  );
  touch(projectId);
  audit(actor.id, "requirement.create_draft", "requirement", id, { projectId, version });
  return getRequirement(id);
}

/** Owner only (checked by the caller). Freezes the draft as the build contract. */
export function approveRequirement(requirementId: string, actor: Operator): Requirement {
  const r = getRequirement(requirementId);
  if (r.status !== "draft") throw new ValaError(409, "Only a draft can be approved.");
  if (checksOf(r).length === 0)
    throw new ValaError(
      400,
      "Add at least one acceptance check: without one, no result can ever be verified.",
    );
  tx(() => {
    run(
      "update requirements set status = 'superseded' where project_id = ? and status = 'approved'",
      r.project_id,
    );
    run(
      "update requirements set status = 'approved', approved_by = ?, approved_at = ? where id = ?",
      actor.id,
      now(),
      r.id,
    );
  });
  touch(r.project_id);
  audit(actor.id, "requirement.approve", "requirement", r.id, {
    projectId: r.project_id,
    version: r.version,
    checks: checksOf(r),
  });
  return getRequirement(r.id);
}

export function raiseChangeRequest(
  projectId: string,
  input: { reason: string; title: string; body: string; checks: unknown },
  raisedBy: string,
): ChangeRequest {
  const current = approvedRequirement(projectId);
  if (!current) throw new ValaError(409, "There is no approved requirement to change.");
  const reason = input.reason?.trim();
  if (!reason) throw new ValaError(400, "A change request needs a reason.");
  const checks = normaliseChecks(input.checks);
  const id = newId("CR", 8);
  run(
    "insert into change_requests (id, project_id, requirement_id, reason, proposed_title, proposed_body, proposed_checks, raised_by, created_at) values (?,?,?,?,?,?,?,?,?)",
    id,
    projectId,
    current.id,
    reason.slice(0, 4000),
    input.title.trim() || current.title,
    input.body.trim() || current.body,
    JSON.stringify(checks),
    raisedBy,
    now(),
  );
  audit(raisedBy, "change_request.raise", "change_request", id, { projectId, against: current.id });
  return one<ChangeRequest>("select * from change_requests where id = ?", id)!;
}

export function listChangeRequests(projectId?: string): ChangeRequest[] {
  return projectId
    ? all<ChangeRequest>(
        "select * from change_requests where project_id = ? order by created_at desc",
        projectId,
      )
    : all<ChangeRequest>("select * from change_requests order by created_at desc limit 200");
}

export function decideChangeRequest(id: string, approve: boolean, actor: Operator): ChangeRequest {
  const cr = one<ChangeRequest>("select * from change_requests where id = ?", id);
  if (!cr) throw new ValaError(404, "Change request not found.");
  if (cr.status !== "open") throw new ValaError(409, "Change request is already decided.");
  tx(() => {
    run(
      "update change_requests set status = ?, decided_by = ?, decided_at = ? where id = ?",
      approve ? "approved" : "rejected",
      actor.id,
      now(),
      id,
    );
    if (approve) {
      const version =
        Number(
          one<{ v: number }>(
            "select coalesce(max(version), 0) as v from requirements where project_id = ?",
            cr.project_id,
          )?.v ?? 0,
        ) + 1;
      run(
        "update requirements set status = 'superseded' where project_id = ? and status = 'approved'",
        cr.project_id,
      );
      run(
        "insert into requirements (id, project_id, version, title, body, acceptance_checks, status, created_by, created_at, approved_by, approved_at) values (?,?,?,?,?,?,?,?,?,?,?)",
        newId("RQ", 8),
        cr.project_id,
        version,
        cr.proposed_title,
        cr.proposed_body,
        cr.proposed_checks,
        "approved",
        cr.raised_by,
        now(),
        actor.id,
        now(),
      );
    }
  });
  touch(cr.project_id);
  audit(
    actor.id,
    approve ? "change_request.approve" : "change_request.reject",
    "change_request",
    id,
    { projectId: cr.project_id },
  );
  return one<ChangeRequest>("select * from change_requests where id = ?", id)!;
}

export function touch(projectId: string) {
  run("update projects set updated_at = ? where id = ?", now(), projectId);
}
