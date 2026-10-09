// @vitest-environment node
import { spawnSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { analyze, build, test as testStep } from "./agent.server.ts";
import { handleApi } from "./api.server.ts";
import { audit, verifyAuditChain } from "./audit.server.ts";
import { requireRole, roleFromPlatform, type Operator } from "./auth.server.ts";
import { closeDb, db, one, run } from "./db.server.ts";
import { parseCommand, runCommand } from "./exec.server.ts";
import {
  decideApproval,
  listReleases,
  requestRelease,
  requestRollback,
} from "./governance.server.ts";
import {
  approveRequirement,
  createProject,
  decideChangeRequest,
  raiseChangeRequest,
  saveDraft,
} from "./projects.server.ts";
import { updateSettings } from "./settings.server.ts";
import {
  canTransition,
  createTask,
  getTask,
  requestCancel,
  taskEvents,
  transition,
  verificationOf,
} from "./tasks.server.ts";
import { claimNext, runStepSafely as runStep } from "./worker.server.ts";
import {
  checkpoint,
  headCommit,
  readWorkspaceFile,
  requireReadyWorkspace,
  resolveInside,
  writeWorkspaceFile,
} from "./workspace.server.ts";

/*
 * Each suite runs against a fresh data directory. The agent loop test uses a
 * small HTTP stub in place of llama-server so the loop is deterministic; it is
 * a test double only — the product talks to the real local model.
 */

const root = mkdtempSync(join(tmpdir(), "vala-ai-test-"));
process.env.VALA_AI_DATA_DIR = join(root, "data");
process.env.VALA_AI_WORKER = "off";

let owner: Operator;
let operator: Operator;
let viewer: Operator;
let sourceRepo: string;

function g(cwd: string, ...args: string[]) {
  const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
    cwd,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

function snapshot(dir: string): string {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(`${p}:${readFileSync(p).toString("base64")}`);
    }
  };
  walk(dir);
  return out.join("\n");
}

beforeAll(() => {
  // Callers as the Control Panel session would resolve them.
  owner = {
    id: "u-owner",
    email: "owner@test.local",
    name: "owner@test.local",
    role: "owner",
  };
  operator = {
    id: "u-op",
    email: "op@test.local",
    name: "op@test.local",
    role: "operator",
  };
  viewer = {
    id: "u-view",
    email: "view@test.local",
    name: "view@test.local",
    role: "viewer",
  };
  // Logic tests use the lowest floors; the floor itself is tested separately below.
  updateSettings({ min_free_disk_gb: 1, min_free_mem_mb: 256 }, owner.id);

  sourceRepo = join(root, "source");
  spawnSync("git", ["init", "--quiet", sourceRepo]);
  writeFileSync(join(sourceRepo, "math.mjs"), "export function add(a, b) {\n  return 0;\n}\n");
  writeFileSync(
    join(sourceRepo, "check.mjs"),
    "import { add } from './math.mjs';\nif (add(2, 3) !== 5) { console.error('add(2,3) =', add(2, 3)); process.exit(1); }\nconsole.log('ok');\n",
  );
  g(sourceRepo, "add", "-A");
  g(sourceRepo, "commit", "--quiet", "-m", "initial");
});

afterAll(() => {
  closeDb();
  rmSync(root, { recursive: true, force: true });
});

describe("database", () => {
  it("applies migrations and keeps the audit log append-only", () => {
    expect(
      Number((db().prepare("pragma user_version").get() as { user_version: number }).user_version),
    ).toBeGreaterThanOrEqual(1);
    audit("test", "test.event", null, null, { a: 1 });
    expect(() => run("update audit_log set action = 'x'")).toThrow(/append-only/);
    expect(() => run("delete from audit_log")).toThrow(/append-only/);
  });

  it("detects a tampered audit entry", () => {
    expect(verifyAuditChain().ok).toBe(true);
    db().exec("drop trigger audit_no_update");
    const seq = one<{ seq: number }>("select min(seq) as seq from audit_log")!.seq;
    run("update audit_log set detail_json = '{\"forged\":true}' where seq = ?", seq);
    const result = verifyAuditChain();
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(seq);
    // Restore for the remaining tests: re-hashing is impossible, so start a clean chain.
    db().exec("drop trigger audit_no_delete; delete from audit_log;");
    db().exec(
      "create trigger audit_no_update before update on audit_log begin select raise(abort, 'audit log is append-only'); end;",
    );
    db().exec(
      "create trigger audit_no_delete before delete on audit_log begin select raise(abort, 'audit log is append-only'); end;",
    );
  });
});

describe("auth (Control Panel roles)", () => {
  it("maps platform roles onto Vala AI roles", () => {
    expect(roleFromPlatform(["boss_owner"])).toBe("owner");
    expect(roleFromPlatform(["super_admin", "developer"])).toBe("owner");
    expect(roleFromPlatform(["developer"])).toBe("operator");
    expect(roleFromPlatform(["admin"])).toBe("operator");
    expect(roleFromPlatform(["finance"])).toBe("viewer");
    expect(roleFromPlatform(["user", "reseller"])).toBeNull();
    expect(roleFromPlatform([])).toBeNull();
  });

  it("enforces roles on the server", () => {
    expect(() => requireRole(null, "viewer")).toThrow(/Sign in to the Control Panel/);
    expect(() => requireRole(viewer, "operator")).toThrow(/operator role/);
    expect(requireRole(owner, "operator").id).toBe(owner.id);
  });
});

describe("command allow-list", () => {
  it("accepts allowed commands and rejects shell syntax and unknown programs", () => {
    expect(parseCommand("npm test")).toEqual(["npm", "test"]);
    expect(parseCommand("node check.mjs")).toEqual(["node", "check.mjs"]);
    expect(() => parseCommand("npm test && rm -rf /")).toThrow();
    expect(() => parseCommand("node check.mjs; whoami")).toThrow();
    expect(() => parseCommand("curl http://x")).toThrow(/not an allowed command/);
    expect(() => parseCommand("node ../outside.js")).toThrow(/parent/);
    expect(() => parseCommand("node $(whoami).js")).toThrow();
  });

  it("kills a command that exceeds its timeout", async () => {
    writeFileSync(join(root, "spin.mjs"), "setInterval(() => {}, 1000);\n");
    const r = await runCommand(["node", "spin.mjs"], {
      cwd: root,
      timeoutMs: 1500,
      maxOutputBytes: 1024,
    });
    expect(r.timedOut).toBe(true);
    expect(r.exitCode).not.toBe(0);
  }, 20_000);

  it("does not pass server secrets to commands", async () => {
    process.env.SUPER_SECRET_TOKEN = "leak-me";
    writeFileSync(
      join(root, "env.mjs"),
      "console.log(process.env.SUPER_SECRET_TOKEN ?? 'absent');\n",
    );
    const r = await runCommand(["node", "env.mjs"], {
      cwd: root,
      timeoutMs: 10_000,
      maxOutputBytes: 1024,
    });
    expect(r.output.trim()).toBe("absent");
    delete process.env.SUPER_SECRET_TOKEN;
  }, 20_000);
});

describe("projects, workspace isolation and scope lock", () => {
  let projectId: string;

  it("creates a project with a permanent id and clones without touching the source", () => {
    const before = snapshot(sourceRepo);
    const { project, workspace, workspaceError } = createProject(
      { name: "Calculator", sourceKind: "git", sourcePath: sourceRepo },
      operator,
    );
    projectId = project.id;
    expect(workspaceError).toBeNull();
    expect(project.id).toMatch(/^VP-[A-Z2-9]{8}$/);
    expect(workspace?.status).toBe("ready");
    expect(snapshot(sourceRepo)).toBe(before);
  });

  it("refuses to create a workspace when a resource floor is not met", () => {
    updateSettings({ min_free_mem_mb: 65536 }, owner.id);
    const r = createProject({ name: "Too big", sourceKind: "empty" }, operator);
    expect(r.workspace?.status).toBe("failed");
    expect(r.workspaceError).toMatch(/Resource limits: Free memory/);
    updateSettings({ min_free_mem_mb: 256 }, owner.id);
  });

  it("keeps file access inside the workspace", () => {
    const ws = requireReadyWorkspace(projectId);
    expect(() => resolveInside(ws, "../escape.txt")).toThrow(/outside/);
    expect(() => resolveInside(ws, "C:/Windows/win.ini")).toThrow(/relative/);
    expect(() => resolveInside(ws, "/etc/passwd")).toThrow(/relative/);
    expect(() => resolveInside(ws, ".git/config")).toThrow(/not editable/);
    writeWorkspaceFile(ws, "notes/a.txt", "hello");
    expect(readWorkspaceFile(ws, "notes/a.txt").content).toBe("hello");
  });

  it("locks approved requirements and changes them only through an approved change request", () => {
    expect(() =>
      saveDraft(
        projectId,
        { title: "T", body: "B", checks: [{ label: "bad", command: "rm -rf x" }] },
        operator,
      ),
    ).toThrow();
    const draft = saveDraft(
      projectId,
      { title: "Add numbers", body: "add(a, b) returns the sum.", checks: [] },
      operator,
    );
    expect(() => approveRequirement(draft.id, owner)).toThrow(/acceptance check/);
    saveDraft(
      projectId,
      {
        requirementId: draft.id,
        title: "Add numbers",
        body: "add(a, b) returns the sum.",
        checks: [{ label: "add works", command: "node check.mjs" }],
      },
      operator,
    );
    const approved = approveRequirement(draft.id, owner);
    expect(approved.status).toBe("approved");
    expect(() =>
      saveDraft(
        projectId,
        {
          requirementId: draft.id,
          title: "x",
          body: "y",
          checks: [{ label: "c", command: "node check.mjs" }],
        },
        operator,
      ),
    ).toThrow(/locked/);

    const cr = raiseChangeRequest(
      projectId,
      {
        reason: "clarify",
        title: "Add numbers",
        body: "add(a, b) returns a + b.",
        checks: [{ label: "add works", command: "node check.mjs" }],
      },
      operator.id,
    );
    decideChangeRequest(cr.id, true, owner);
    const versions = db()
      .prepare("select version, status from requirements where project_id = ? order by version")
      .all(projectId) as { version: number; status: string }[];
    expect(versions).toEqual([
      { version: 1, status: "superseded" },
      { version: 2, status: "approved" },
    ]);
  });

  it("checks every state transition against the table", () => {
    expect(canTransition("PENDING", "ANALYZING")).toBe(true);
    expect(canTransition("PENDING", "COMPLETE")).toBe(false);
    expect(canTransition("TESTING", "COMPLETE")).toBe(false);
    expect(canTransition("VERIFIED", "COMPLETE")).toBe(true);
    expect(canTransition("COMPLETE", "PENDING")).toBe(false);
  });

  it("cancels a pending task and refuses illegal jumps", () => {
    const t = createTask(projectId, { title: "noop", instruction: "nothing" }, operator);
    expect(() => transition(t.id, "COMPLETE", "skip")).toThrow(/cannot move/);
    expect(requestCancel(t.id, operator).state).toBe("CANCELLED");
  });

  it("resumes a task whose runner died, from the state it was in", () => {
    const t = createTask(projectId, { title: "recover", instruction: "x" }, operator);
    run(
      "update tasks set lease_owner = 'dead-runner', lease_until = ? where id = ?",
      new Date(Date.now() - 1000).toISOString(),
      t.id,
    );
    const claimed = claimNext("new-runner");
    expect(claimed?.id).toBe(t.id);
    expect(taskEvents(t.id).some((e) => e.kind === "recovered")).toBe(true);
    requestCancel(t.id, operator);
  });
});

describe("agent loop with a stub model (test double)", () => {
  let server: Server;
  let projectId: string;
  let builds = 0;
  let cheat = false;

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        res.setHeader("content-type", "application/json");
        if (req.url === "/health") {
          res.end(JSON.stringify({ status: "ok" }));
          return;
        }
        if (req.url === "/v1/models") {
          res.end(JSON.stringify({ data: [{ id: "stub" }] }));
          return;
        }
        const schema = JSON.parse(body).response_format?.schema;
        let content: unknown;
        if (schema?.properties?.scope_conflict)
          content = {
            summary: "Implement add",
            files_to_read: ["math.mjs"],
            steps: ["edit add"],
            scope_conflict: "",
          };
        else if (cheat) {
          // A model that tries to make the check pass by rewriting the check itself.
          content = {
            edits: [{ path: "check.mjs", action: "write", content: "process.exit(0);\n" }],
            notes: "made the check pass",
          };
        } else {
          builds++;
          // First attempt is wrong on purpose so the loop must go through FIXING and RETESTING.
          content = {
            edits: [
              {
                path: "math.mjs",
                action: "write",
                content: `export function add(a, b) {\n  return ${builds === 1 ? "a - b" : "a + b"};\n}\n`,
              },
            ],
            notes: `attempt ${builds}`,
          };
        }
        res.end(
          JSON.stringify({
            model: "stub",
            choices: [{ message: { content: JSON.stringify(content) } }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          }),
        );
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const port = (server.address() as { port: number }).port;
    updateSettings({ model_url: `http://127.0.0.1:${port}` }, owner.id);
    projectId = createProject({ name: "Loop", sourceKind: "git", sourcePath: sourceRepo }, operator)
      .project.id;
    const d = saveDraft(
      projectId,
      {
        title: "Add",
        body: "add returns the sum",
        checks: [{ label: "add works", command: "node check.mjs" }],
      },
      operator,
    );
    approveRequirement(d.id, owner);
  });

  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("plans, builds, fails, fixes, retests, verifies independently and completes", async () => {
    const t = createTask(
      projectId,
      { title: "Implement add", instruction: "Make add return the sum." },
      operator,
    );
    const signal = new AbortController().signal;
    const states: string[] = [];
    for (let i = 0; i < 12; i++) {
      const cur = getTask(t.id);
      states.push(cur.state);
      if (["COMPLETE", "FAILED", "CANCELLED", "BLOCKED"].includes(cur.state)) break;
      await runStep(cur, "test-runner", signal);
    }
    const final = getTask(t.id);
    expect(final.error).toBeNull();
    expect(final.state).toBe("COMPLETE");
    expect(states).toEqual([
      "PENDING",
      "ANALYZING",
      "BUILDING",
      "TESTING",
      "FIXING",
      "RETESTING",
      "VERIFIED",
      "COMPLETE",
    ]);
    const v = verificationOf(final);
    expect(v.status).toBe("VERIFIED");
    expect(v.commit).toBe(headCommit(requireReadyWorkspace(projectId)));
    const ev = db()
      .prepare(
        "select producer, verdict from evidence where task_id = ? order by created_at, rowid",
      )
      .all(t.id) as { producer: string; verdict: string }[];
    expect(ev).toEqual([
      { producer: "agent", verdict: "fail" },
      { producer: "agent", verdict: "pass" },
      { producer: "verifier", verdict: "pass" },
    ]);
    expect(readFileSync(join(requireReadyWorkspace(projectId).path, "math.mjs"), "utf8")).toContain(
      "a + b",
    );
    // The original source is untouched.
    expect(readFileSync(join(sourceRepo, "math.mjs"), "utf8")).toContain("return 0");

    // Release: only through an approval, recorded immutably with a hash-checked patch.
    const ap = requestRelease(t.id, "v1.0.0", operator);
    const decided = decideApproval(
      ap.id,
      { approve: true, note: "checked", evidenceReviewed: ["all"] },
      owner,
    );
    expect(decided.status).toBe("executed");
    const rel = listReleases(projectId)[0];
    expect(rel.label).toBe("v1.0.0");
    expect(readFileSync(rel.patch_path, "utf8")).toContain("+  return a + b;");
    expect(() => run("update releases set label = 'x' where id = ?", rel.id)).toThrow(/immutable/);
  }, 60_000);

  it("refuses edits to the files the acceptance checks depend on", async () => {
    cheat = true;
    const ws = requireReadyWorkspace(projectId);
    const before = readFileSync(join(ws.path, "check.mjs"), "utf8");
    const t = createTask(
      projectId,
      { title: "cheat", instruction: "Make the check pass." },
      operator,
    );
    const signal = new AbortController().signal;
    for (let i = 0; i < 8; i++) {
      const cur = getTask(t.id);
      if (["COMPLETE", "FAILED", "CANCELLED", "BLOCKED"].includes(cur.state)) break;
      await runStep(cur, "test-runner", signal);
    }
    cheat = false;
    const final = getTask(t.id);
    expect(final.state).toBe("FAILED");
    expect(final.error).toMatch(/refused/);
    expect(taskEvents(t.id).some((e) => e.kind === "guard" && /check\.mjs/.test(e.message))).toBe(
      true,
    );
    expect(readFileSync(join(ws.path, "check.mjs"), "utf8")).toBe(before);
    expect(verificationOf(final).status).not.toBe("VERIFIED");
  }, 60_000);

  it("reports UNKNOWN, not VERIFIED, when the verifier never ran", () => {
    const t = createTask(projectId, { title: "u", instruction: "u" }, operator);
    expect(verificationOf(getTask(t.id)).status).toBe("UNKNOWN");
    expect(() => requestRelease(t.id, "v-unverified", operator)).toThrow(/COMPLETE/);
    requestCancel(t.id, operator);
  });

  it("rolls the workspace back only through an approval, and verifies the result", () => {
    const ws = requireReadyWorkspace(projectId);
    const target = ws.base_commit!;
    writeWorkspaceFile(ws, "junk.txt", "x");
    checkpoint(ws, "junk", null, operator.id);
    const ap = requestRollback(projectId, target, "undo junk", operator);
    expect(headCommit(ws)).not.toBe(target);
    const done = decideApproval(ap.id, { approve: true }, owner);
    expect(done.status).toBe("executed");
    expect(done.outcome).toMatch(/verified HEAD matches/);
    expect(headCommit(ws)).toBe(target);
  });

  it("blocks instead of failing when the local model is offline", async () => {
    updateSettings({ model_url: "http://127.0.0.1:9" }, owner.id);
    const t = createTask(projectId, { title: "offline", instruction: "x" }, operator);
    await runStep(getTask(t.id), "test-runner", new AbortController().signal);
    const after = getTask(t.id);
    expect(after.state).toBe("BLOCKED");
    expect(after.blocked_reason).toMatch(/Local model offline/);
  });
});

describe("HTTP API", () => {
  const base = "http://localhost/api/vala-ai";
  // The route passes the Control Panel resolver; here a token stands for a resolved session.
  const resolve = async (req: Request) =>
    (({ "t-view": viewer, "t-op": operator }) as Record<string, Operator>)[
      (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    ] ?? null;
  const call = (path: string, init: RequestInit = {}) =>
    handleApi(new Request(base + path, init), resolve);

  it("requires a Control Panel session and the right role", async () => {
    expect((await call("/projects")).status).toBe(401);
    expect((await call("/session")).status).toBe(200);
    expect(await (await call("/session")).json()).toEqual({ operator: null });
    expect((await call("/projects", { headers: { authorization: "Bearer t-view" } })).status).toBe(
      200,
    );
    const denied = await call("/projects", {
      method: "POST",
      headers: { authorization: "Bearer t-view" },
      body: JSON.stringify({ name: "x", sourceKind: "empty" }),
    });
    expect(denied.status).toBe(403);
    expect(
      (
        await call("/settings", {
          method: "PATCH",
          headers: { authorization: "Bearer t-op" },
          body: "{}",
        })
      ).status,
    ).toBe(403);
    expect((await call("/nope", { headers: { authorization: "Bearer t-op" } })).status).toBe(404);
  });

  it("records who used it", async () => {
    await call("/status", { headers: { authorization: "Bearer t-op" } });
    const people = await (
      await call("/people", { headers: { authorization: "Bearer t-op" } })
    ).json();
    expect(people.map((p: { email: string }) => p.email)).toContain("op@test.local");
  }, 20_000);
});
