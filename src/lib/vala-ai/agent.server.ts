import { readFileSync } from "node:fs";
import { audit } from "./audit.server.ts";
import { run } from "./db.server.ts";
import { chatJson, type ChatMessage } from "./model.server.ts";
import { checksOf, getProject, getRequirement, raiseChangeRequest } from "./projects.server.ts";
import { getSettings } from "./settings.server.ts";
import {
  addEvent,
  getTask,
  listEvidence,
  runCheck,
  transition,
  verificationOf,
  type Evidence,
  type Task,
} from "./tasks.server.ts";
import { parseJson, ValaError } from "./util.server.ts";
import {
  changedFiles,
  changedPathsBetween,
  checkpoint,
  deleteWorkspaceFile,
  diffBetween,
  getWorkspace,
  headCommit,
  isClean,
  listFiles,
  readWorkspaceFile,
  requireReadyWorkspace,
  writeWorkspaceFile,
  type Workspace,
} from "./workspace.server.ts";

/**
 * One step of the agent per call: UNDERSTAND/PLAN (ANALYZING), EXECUTE
 * (BUILDING), OBSERVE (TESTING), FIX, RETEST, VERIFY, REPORT (COMPLETE).
 *
 * The model only ever proposes; this code decides. Its plan and its edits
 * are schema-constrained JSON, every edit goes through the workspace path
 * guard and the write budget, and "it works" is never taken from the model:
 * the acceptance checks of the approved requirement are run, and then run
 * again by the verifier on a clean, committed tree. The files those checks
 * depend on are protected: the agent cannot edit them, and the verifier
 * refuses a result in which they changed — otherwise "make the test pass"
 * could be achieved by changing the test.
 */

export type Plan = {
  summary: string;
  files_to_read: string[];
  steps: string[];
  scope_conflict: string;
};
type Edit = { path: string; action: "write" | "delete"; content: string };
type EditSet = { edits: Edit[]; notes: string };

const PROMPT_FILE_BUDGET = 10_000; // characters of file content per model call; prompt processing is ~20 tok/s on CPU
const AGENT_ID = (taskId: string) => `agent:${taskId}`;

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    files_to_read: { type: "array", items: { type: "string" }, maxItems: 6 },
    steps: { type: "array", items: { type: "string" }, maxItems: 8 },
    scope_conflict: { type: "string" },
  },
  required: ["summary", "files_to_read", "steps", "scope_conflict"],
};

const EDIT_SCHEMA = {
  type: "object",
  properties: {
    edits: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          action: { type: "string", enum: ["write", "delete"] },
          content: { type: "string" },
        },
        required: ["path", "action", "content"],
      },
    },
    notes: { type: "string" },
  },
  required: ["edits", "notes"],
};

const SYSTEM = `You are Vala AI, a careful software engineer working inside one isolated project workspace.
You only change files needed for the task. You never invent requirements beyond the approved contract.
When you rewrite a file, keep every existing function, export and line that the task does not ask you to change.
Files marked READ-ONLY (the acceptance checks and tests) can never be changed; make the code satisfy them.
Paths are relative to the workspace root. Reply with JSON only, matching the schema.`;

const TEST_FILE = /(^|\/)(__tests__|tests?)\/|\.(test|spec)\.[cm]?[jt]sx?$/;

/** Files the acceptance checks depend on: named in a check command, test files, and the package manifest. */
export function protectedPaths(task: Task, ws: Workspace): Set<string> {
  const files = listFiles(ws, 20_000);
  const known = new Set(files);
  const out = new Set<string>(["package.json", "package-lock.json"]);
  for (const check of checksOf(getRequirement(task.requirement_id))) {
    for (const token of check.command.split(/\s+/)) {
      const t = token.replace(/^\.\//, "");
      if (known.has(t)) out.add(t);
    }
  }
  for (const f of files) if (TEST_FILE.test(f)) out.add(f);
  return out;
}

const norm = (p: string) => p.replace(/\\/g, "/").replace(/^\.\//, "").trim();

/** The start and end of a check's stored output: the error message is usually at the top, the summary at the bottom. */
function failureExcerpt(e: Evidence): string {
  let text = e.output_tail;
  try {
    text = readFileSync(e.output_path, "utf8").split("\n\n").slice(1).join("\n\n") || text;
  } catch {
    /* fall back to the stored tail */
  }
  return text.length <= 2200 ? text : `${text.slice(0, 1500)}\n…\n${text.slice(-700)}`;
}

function contractText(task: Task) {
  const req = getRequirement(task.requirement_id);
  const checks = checksOf(req)
    .map((c) => `- ${c.label}: \`${c.command}\``)
    .join("\n");
  return `APPROVED REQUIREMENT v${req.version}: ${req.title}\n${req.body}\n\nACCEPTANCE CHECKS (must all exit 0):\n${checks}`;
}

function filesBlock(ws: Workspace, files: string[]): string {
  let budget = PROMPT_FILE_BUDGET;
  const parts: string[] = [];
  for (const f of files) {
    if (budget <= 0) {
      parts.push(`--- ${f} (omitted: prompt budget reached)`);
      continue;
    }
    try {
      const file = readWorkspaceFile(ws, f, Math.min(budget, getSettings().max_file_kb * 1024));
      parts.push(`--- ${f}${file.truncated ? " (truncated)" : ""}\n${file.content}`);
      budget -= file.content.length;
    } catch (e) {
      parts.push(`--- ${f} (${(e as ValaError).message})`);
    }
  }
  return parts.join("\n\n");
}

/** The check and test files the model must satisfy but cannot change, as read-only context. */
function readOnlyBlock(task: Task, ws: Workspace): string {
  const present = new Set(listFiles(ws, 20_000));
  const files = [...protectedPaths(task, ws)]
    .filter((f) => f !== "package-lock.json" && present.has(f))
    .slice(0, 4);
  if (files.length === 0) return "";
  return `READ-ONLY FILES (cannot be changed):\n${filesBlock(ws, files)}\n\n`;
}

function recordModel(
  taskId: string,
  step: string,
  reply: {
    model: string;
    source: string;
    service: string | null;
    durationMs: number;
    tokensIn: number | null;
    tokensOut: number | null;
  },
) {
  const via =
    reply.source === "local"
      ? "local model"
      : `AI API Manager (${reply.service ?? "service"}), model`;
  addEvent(
    taskId,
    "model",
    `${step}: ${via} ${reply.model} answered in ${(reply.durationMs / 1000).toFixed(1)}s.`,
    {
      source: reply.source,
      service: reply.service,
      model: reply.model,
      tokensIn: reply.tokensIn,
      tokensOut: reply.tokensOut,
      ...(reply.source === "ai-api-manager"
        ? { usage: "recorded by AI API Manager in usage_events (product vala-ai)" }
        : {}),
    },
  );
}

export async function analyze(task: Task, signal: AbortSignal) {
  const ws = requireReadyWorkspace(task.project_id);
  const project = getProject(task.project_id);
  run(
    "update tasks set start_commit = coalesce(start_commit, ?) where id = ?",
    headCommit(ws),
    task.id,
  );
  const tree = listFiles(ws, 300);
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content:
        `PROJECT ${project.id}: ${project.name}\n${project.description}\n\n${contractText(task)}\n\nTASK: ${task.title}\n${task.instruction}\n\nFILES IN WORKSPACE (${tree.length}${tree.length >= 300 ? "+" : ""}):\n${tree.join("\n")}\n\n` +
        `Make a short plan. files_to_read: up to 6 existing or new file paths you need. ` +
        `scope_conflict: empty string if the task fits the approved requirement; otherwise one sentence explaining what falls outside it.`,
    },
  ];
  const { value, reply } = await chatJson<Plan>(messages, PLAN_SCHEMA, { maxTokens: 600, signal });
  recordModel(task.id, "Plan", reply);
  const plan: Plan = {
    summary: String(value.summary).slice(0, 2000),
    files_to_read: value.files_to_read.map(String).slice(0, 6),
    steps: value.steps.map(String).slice(0, 8),
    scope_conflict: String(value.scope_conflict ?? "").trim(),
  };
  run("update tasks set plan_json = ? where id = ?", JSON.stringify(plan), task.id);
  addEvent(task.id, "plan", plan.summary, plan);

  if (plan.scope_conflict) {
    const req = getRequirement(task.requirement_id);
    const cr = raiseChangeRequest(
      task.project_id,
      {
        reason: `Task ${task.id}: ${plan.scope_conflict}`,
        title: req.title,
        body: req.body,
        checks: checksOf(req),
      },
      AGENT_ID(task.id),
    );
    transition(
      task.id,
      "BLOCKED",
      `Scope lock: the task appears to go beyond the approved requirement. Change request ${cr.id} raised for an owner to decide.`,
    );
    return;
  }
  transition(task.id, "BUILDING", "Plan recorded.");
}

async function applyEdits(
  task: Task,
  ws: Workspace,
  edits: Edit[],
  label: string,
): Promise<string[]> {
  const budget = getSettings().max_task_write_kb * 1024;
  let written = getTask(task.id).bytes_written;
  const touched: string[] = [];
  const guarded = protectedPaths(task, ws);
  for (const edit of edits) {
    if (guarded.has(norm(edit.path))) {
      addEvent(
        task.id,
        "guard",
        `Refused an edit to ${edit.path}: acceptance checks depend on it.`,
        { path: edit.path },
      );
      continue;
    }
    if (edit.action === "delete") {
      const r = deleteWorkspaceFile(ws, edit.path);
      addEvent(task.id, "file", `Deleted ${r.path}`, r);
    } else {
      const bytes = Buffer.byteLength(edit.content, "utf8");
      if (written + bytes > budget)
        throw new ValaError(
          413,
          `Write budget of ${getSettings().max_task_write_kb} KB for this task is exhausted.`,
        );
      const r = writeWorkspaceFile(ws, edit.path, edit.content);
      written += bytes;
      addEvent(
        task.id,
        "file",
        `${r.beforeSha ? "Updated" : "Created"} ${r.path} (${r.bytes} bytes)`,
        r,
      );
    }
    touched.push(edit.path);
  }
  run("update tasks set bytes_written = ? where id = ?", written, task.id);
  if (touched.length === 0) return touched;
  const cp = checkpoint(ws, `${task.id}: ${label}`, task.id, AGENT_ID(task.id));
  addEvent(task.id, "checkpoint", `Checkpoint ${cp.sha.slice(0, 10)} (${label}).`, cp);
  return touched;
}

export async function build(task: Task, signal: AbortSignal) {
  const ws = requireReadyWorkspace(task.project_id);
  const plan = parseJson<Plan | null>(task.plan_json, null);
  if (!plan) throw new ValaError(500, "Task has no recorded plan.");
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content:
        `${contractText(task)}\n\nTASK: ${task.title}\n${task.instruction}\n\nPLAN:\n${plan.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nCURRENT FILES:\n${filesBlock(
          ws,
          plan.files_to_read.filter((f) => !protectedPaths(task, ws).has(norm(f))),
        )}\n\n${readOnlyBlock(task, ws)}` +
        `Return the edits. For "write", content is the COMPLETE new file content. For "delete", content is "".`,
    },
  ];
  const { value, reply } = await chatJson<EditSet>(messages, EDIT_SCHEMA, { signal });
  recordModel(task.id, "Build", reply);
  if (!Array.isArray(value.edits) || value.edits.length === 0)
    throw new ValaError(422, "The model proposed no edits.");
  const touched = await applyEdits(task, ws, value.edits, "build");
  if (touched.length === 0) throw new ValaError(422, "Every edit the model proposed was refused.");
  addEvent(task.id, "notes", value.notes || "No notes.", { files: touched });
  run(
    "update tasks set plan_json = ? where id = ?",
    JSON.stringify({
      ...plan,
      files_to_read: [...new Set([...plan.files_to_read, ...touched])].slice(0, 8),
    }),
    task.id,
  );
  transition(task.id, "TESTING", `Applied ${touched.length} file change(s).`);
}

/** OBSERVE: the agent's own run of every acceptance check. */
export async function test(task: Task, signal: AbortSignal) {
  const ws = requireReadyWorkspace(task.project_id);
  const checks = checksOf(getRequirement(task.requirement_id));
  const results: Evidence[] = [];
  for (const check of checks) {
    if (signal.aborted) throw new ValaError(499, "Cancelled.");
    results.push(await runCheck(task, ws, check, "agent", signal));
  }
  if (results.every((r) => r.verdict === "pass")) {
    await verify(getTask(task.id), ws, signal);
    return;
  }
  const fresh = getTask(task.id);
  if (fresh.fix_loops >= fresh.max_fix_loops) {
    transition(task.id, "FAILED", `Checks still failing after ${fresh.fix_loops} fix attempt(s).`, {
      error:
        results
          .filter((r) => r.verdict !== "pass")
          .map((r) => r.label)
          .join(", ") + " failing",
    });
    return;
  }
  transition(
    task.id,
    "FIXING",
    `${results.filter((r) => r.verdict !== "pass").length} of ${results.length} check(s) failed.`,
  );
}

export async function fix(task: Task, signal: AbortSignal) {
  const ws = requireReadyWorkspace(task.project_id);
  const plan = parseJson<Plan | null>(task.plan_json, null);
  const failing = listEvidence({ taskId: task.id })
    .filter((e) => e.producer === "agent")
    .slice(-checksOf(getRequirement(task.requirement_id)).length)
    .filter((e) => e.verdict !== "pass");
  const failures = failing
    .map(
      (e) =>
        `CHECK "${e.label}" \`${e.command}\` exit ${e.exit_code}${e.timed_out ? " (timed out)" : ""}\n${failureExcerpt(e)}`,
    )
    .join("\n\n");
  const fresh = getTask(task.id);
  let changes = "";
  if (fresh.start_commit) {
    const d = diffBetween(ws, fresh.start_commit, headCommit(ws)).diff;
    changes = d.length > 2500 ? `${d.slice(0, 2500)}\n… (diff truncated)` : d;
  }
  const guarded = protectedPaths(task, ws);
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content:
        `${contractText(task)}\n\nTASK: ${task.title}\n${task.instruction}\n\nFAILING CHECKS:\n${failures}\n\nYOUR CHANGES SO FAR (diff from the starting code):\n${changes || "(none)"}\n\nCURRENT FILES:\n${filesBlock(
          ws,
          (plan?.files_to_read ?? []).filter((f) => !guarded.has(norm(f))),
        )}\n\n${readOnlyBlock(task, ws)}` +
        `Fix the cause of the failures. Return the edits; for "write", content is the COMPLETE new file content.`,
    },
  ];
  const { value, reply } = await chatJson<EditSet>(messages, EDIT_SCHEMA, { signal });
  recordModel(task.id, "Fix", reply);
  run("update tasks set fix_loops = fix_loops + 1 where id = ?", task.id);
  if (!Array.isArray(value.edits) || value.edits.length === 0) {
    addEvent(task.id, "notes", "The model proposed no fix edits.");
    transition(task.id, "RETESTING", "No changes proposed; retesting as-is.");
    return;
  }
  const touched = await applyEdits(task, ws, value.edits, `fix ${getTask(task.id).fix_loops}`);
  addEvent(task.id, "notes", value.notes || "No notes.", { files: touched });
  transition(
    task.id,
    "RETESTING",
    touched.length
      ? `Applied ${touched.length} fix change(s).`
      : "Every proposed edit was refused; retesting as-is.",
  );
}

/**
 * VERIFY: a separate re-execution of every check, at a pinned commit, on a
 * clean tree. The agent's own passing runs are not enough.
 */
export async function verify(task: Task, ws: Workspace, signal: AbortSignal) {
  if (!isClean(ws)) {
    const dirty = changedFiles(ws)
      .map((f) => f.path)
      .slice(0, 10);
    addEvent(
      task.id,
      "verify",
      `Checks left uncommitted changes (${dirty.join(", ")}); committing them so the verifier runs on a pinned tree.`,
    );
    checkpoint(ws, `${task.id}: pre-verify`, task.id, AGENT_ID(task.id));
  }
  if (task.start_commit) {
    const guarded = protectedPaths(task, ws);
    const tampered = changedPathsBetween(ws, task.start_commit, headCommit(ws)).filter((p) =>
      guarded.has(p),
    );
    if (tampered.length) {
      transition(
        task.id,
        "FAILED",
        `Verification refused: files the acceptance checks depend on were changed (${tampered.join(", ")}).`,
        { error: "protected files changed" },
      );
      return;
    }
  }
  const checks = checksOf(getRequirement(task.requirement_id));
  for (const check of checks) {
    if (signal.aborted) throw new ValaError(499, "Cancelled.");
    await runCheck(task, ws, check, "verifier", signal);
  }
  const v = verificationOf(getTask(task.id));
  if (v.status === "VERIFIED") {
    transition(
      task.id,
      "VERIFIED",
      `Verifier re-ran ${checks.length} check(s) at ${v.commit?.slice(0, 10)}: all passed.`,
    );
    return;
  }
  const fresh = getTask(task.id);
  if (fresh.fix_loops >= fresh.max_fix_loops) {
    transition(
      task.id,
      "FAILED",
      `Verifier result ${v.status}: the agent's passing run was not reproduced.`,
      { error: "verification did not reproduce" },
    );
  } else {
    transition(
      task.id,
      "FIXING",
      `Verifier result ${v.status}: the agent's passing run was not reproduced.`,
    );
  }
}

/** REPORT: what changed, against which contract, with which evidence. */
export function complete(task: Task) {
  const ws = getWorkspace(task.project_id);
  const v = verificationOf(task);
  if (v.status !== "VERIFIED" || !ws || !v.commit) {
    transition(task.id, "FAILED", "Completion refused: verification is not VERIFIED.", {
      error: `verification ${v.status}`,
    });
    return;
  }
  const from = task.start_commit ?? ws.base_commit ?? v.commit;
  const stat = diffBetween(ws, from, v.commit).stat.trim();
  const summary = `Verified at ${v.commit.slice(0, 10)}: ${v.checks.length} acceptance check(s) passed on the verifier's re-run.\n${stat || "No file differences."}`;
  transition(task.id, "COMPLETE", "Task complete.", { result_summary: summary });
  audit(AGENT_ID(task.id), "task.complete", "task", task.id, {
    from,
    commit: v.commit,
    evidence: v.checks.map((c) => c.evidence?.id),
  });
}
