import { audit } from "./audit.server.ts";
import type { Operator } from "./auth.server.ts";
import { all, one, run, tx } from "./db.server.ts";
import { getProject } from "./projects.server.ts";
import { verificationOf, listTasks } from "./tasks.server.ts";
import { newId, now, ValaError, parseJson } from "./util.server.ts";

export const FLOW_STEPS = [
  "requirement intake", // 1
  "requirement analysis", // 2
  "library match", // 3
  "match evidence", // 4
  "owner approval", // 5
  "isolated workspace", // 6
  "branding", // 7
  "AI development", // 8
  "code review", // 9
  "unit tests", // 10
  "integration tests", // 11
  "bug fixing", // 12
  "retest", // 13
  "QA sign-off", // 14
  "security scan", // 15
  "performance check", // 16
  "release gate", // 17
  "version create", // 18
  "license generate", // 19
  "delivery package", // 20
  "client delivery", // 21
  "deployment", // 22
  "deploy verification", // 23
  "client handover", // 24
  "support window", // 25
  "client issue intake", // 26
  "issue fix", // 27
  "recovery", // 28
  "upgrade request", // 29
  "new version", // 30
] as const;

export type Version = {
  id: string;
  project_id: string;
  version_code: string;
  change_history: string;
  test_status: "not_tested" | "passed" | "failed";
  delivery_status: "not_delivered" | "delivered";
  created_at: string;
};

export type Issue = {
  id: string;
  issue_code: string;
  project_id: string;
  version_id: string | null;
  kind: string;
  text: string;
  status: "open" | "fixed" | "closed";
  fixed_version_id: string | null;
  created_at: string;
};

export type FlowState = {
  project_id: string;
  current_step: number;
  step_data_json: string;
  updated_at: string;
};

export function listFlow() {
  const projects = all<any>(
    "select p.*, fs.current_step, fs.step_data_json, fs.updated_at as flow_updated_at " +
    "from projects p left join flow_state fs on p.id = fs.project_id " +
    "order by p.updated_at desc"
  );
  return projects.map(p => ({
    ...p,
    current_step: p.current_step || 1,
    steps: parseJson(p.step_data_json, {})
  }));
}

export function advanceFlow(projectId: string, step: number, actor: Operator) {
  if (step < 1 || step > 30) throw new ValaError(400, "Step must be between 1 and 30.");
  const p = getProject(projectId);
  
  tx(() => {
    const existing = one("select * from flow_state where project_id = ?", projectId);
    const stepData = existing ? parseJson<any>(existing.step_data_json, {}) : {};
    stepData[step] = { status: "completed", at: now(), actor: actor.id };
    
    run(
      "insert into flow_state (project_id, current_step, step_data_json, updated_at) values (?,?,?,?) " +
      "on conflict(project_id) do update set current_step = excluded.current_step, step_data_json = excluded.step_data_json, updated_at = excluded.updated_at",
      projectId,
      step,
      JSON.stringify(stepData),
      now()
    );
    
    // Release gate check: step 18 (version create) needs all tasks to be verified
    if (step === 18) {
       // Handled by createVersion
    }
  });

  audit(actor.id, "flow.advance", "project", projectId, { step, stepName: FLOW_STEPS[step - 1] });
}

export function reportIssue(projectId: string, input: { versionId?: string, kind: string, text: string }, actor: Operator) {
  const id = newId("IS", 10);
  const issueCode = "SV-ISSUE-" + Math.random().toString(16).slice(2, 10).toUpperCase();
  run(
    "insert into issues (id, issue_code, project_id, version_id, kind, text, status, created_at) values (?,?,?,?,?,?,?,?)",
    id,
    issueCode,
    projectId,
    input.versionId || null,
    input.kind,
    input.text,
    "open",
    now()
  );
  audit(actor.id, "issue.report", "issue", id, { projectId, versionId: input.versionId });
  return one("select * from issues where id = ?", id);
}

export function listIssues(projectId: string) {
  return all("select * from issues where project_id = ? order by created_at desc", projectId);
}

export function createVersion(projectId: string, input: { changeHistory: string }, actor: Operator) {
  // Check if project has any tasks that are not complete/verified? 
  // Actually the prompt says: "Version test_status can only be set to 'passed' after the project's tasks reach a verified/complete state"
  // So we can create a version anytime, but its test_status will be checked during delivery.
  
  const id = newId("V", 10);
  const versionCode = "SV-VERSION-" + Math.random().toString(16).slice(2, 10).toUpperCase();
  
  // Check tasks to set initial test_status
  const tasks = listTasks({ projectId });
  const allVerified = tasks.length > 0 && tasks.every(t => t.state === "COMPLETE" || t.state === "VERIFIED");
  const testStatus = allVerified ? "passed" : "not_tested";

  run(
    "insert into versions (id, project_id, version_code, change_history, test_status, delivery_status, created_at) values (?,?,?,?,?,?,?)",
    id,
    projectId,
    versionCode,
    input.changeHistory,
    testStatus,
    "not_delivered",
    now()
  );
  audit(actor.id, "version.create", "version", id, { projectId, versionCode });
  return one("select * from versions where id = ?", id);
}

export function deliverVersion(versionId: string, actor: Operator) {
  const v = one<Version>("select * from versions where id = ?", versionId);
  if (!v) throw new ValaError(404, "Version not found.");
  
  if (v.test_status !== "passed") {
    throw new ValaError(409, "Version cannot be delivered unless test status is 'passed'.");
  }
  
  run("update versions set delivery_status = 'delivered' where id = ?", versionId);
  audit(actor.id, "version.deliver", "version", versionId, { projectId: v.project_id });
  return one("select * from versions where id = ?", versionId);
}

export function updateVersionTestStatus(versionId: string, actor: Operator) {
  const v = one<Version>("select * from versions where id = ?", versionId);
  if (!v) throw new ValaError(404, "Version not found.");
  
  const tasks = listTasks({ projectId: v.project_id });
  const allVerified = tasks.length > 0 && tasks.every(t => t.state === "COMPLETE" || t.state === "VERIFIED");
  
  if (allVerified) {
    run("update versions set test_status = 'passed' where id = ?", versionId);
    audit(actor.id, "version.test_pass", "version", versionId, { projectId: v.project_id });
  }
  return one("select * from versions where id = ?", versionId);
}

export function listVersions(projectId: string) {
  return all("select * from versions where project_id = ? order by created_at desc", projectId);
}
