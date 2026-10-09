// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handleApi } from "./api.server.ts";
import type { Operator } from "./auth.server.ts";
import { dataDir } from "./config.server.ts";
import { closeDb, run } from "./db.server.ts";
import { createProject } from "./projects.server.ts";

/*
 * Owners see the server's layout; operators and viewers do not. Exercised
 * through the real dispatcher on every endpoint that carries a path.
 */

const root = mkdtempSync(join(tmpdir(), "vala-redact-"));
process.env.VALA_AI_DATA_DIR = join(root, "data");
process.env.VALA_AI_WORKER = "off";
const source = join(root, "source repo");

const owner: Operator = { id: "u-owner", email: "owner@test.local", name: "owner", role: "owner" };
const operator: Operator = { id: "u-op", email: "op@test.local", name: "op", role: "operator" };
const viewer: Operator = { id: "u-view", email: "view@test.local", name: "view", role: "viewer" };
const who: Record<string, Operator> = { owner, operator, viewer };
const resolve = async (req: Request) => who[req.headers.get("x-test-caller") ?? ""] ?? null;
const get = async (as: string, path: string) => {
  const res = await handleApi(
    new Request(`http://localhost/api/vala-ai${path}`, { headers: { "x-test-caller": as } }),
    resolve,
  );
  return { status: res.status, text: await res.text() };
};

let projectId = "";
const evidenceId = "EV-REDACTTEST";
const leaks = (text: string) => {
  const dir = dataDir();
  const variants = [
    dir,
    dir.replace(/\\/g, "/"),
    dir.replace(/\\/g, "\\\\"),
    source,
    source.replace(/\\/g, "\\\\"),
    source.replace(/\\/g, "/"),
  ];
  return variants.filter((v) => text.toLowerCase().includes(v.toLowerCase()));
};

beforeAll(() => {
  spawnSync("git", ["init", "--quiet", source]);
  writeFileSync(join(source, "README.md"), "# hello\n");
  spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "add", "-A"], { cwd: source });
  spawnSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-m", "init"],
    { cwd: source },
  );
  projectId = createProject({ name: "Redaction", sourceKind: "git", sourcePath: source }, owner)
    .project.id;
  // Evidence whose stored output mentions the workspace, as a stack trace would.
  const out = join(dataDir(), "evidence", projectId, `${evidenceId}.log`);
  run(
    `insert into evidence (id, task_id, project_id, check_id, label, command, commit_sha, exit_code, timed_out, duration_ms, output_path, output_sha256, output_tail, producer, verdict, created_at)
     values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    evidenceId,
    null,
    projectId,
    "C1",
    "probe",
    "node check.mjs",
    null,
    1,
    0,
    5,
    out,
    "0".repeat(64),
    `Error at ${join(dataDir(), "workspaces", projectId, "check.mjs")}:3:7`,
    "agent",
    "fail",
    new Date().toISOString(),
  );
});

afterAll(() => {
  closeDb();
  rmSync(root, { recursive: true, force: true });
});

const endpoints = () => [
  "/status",
  "/projects",
  `/projects/${projectId}`,
  "/evidence",
  "/audit",
  "/tasks",
  "/releases",
];

describe("server layout is visible to owners only", () => {
  it("owners see the paths and the runner", async () => {
    const status = await get("owner", "/status");
    expect(JSON.parse(status.text).dataDir).toBe(dataDir());
    const detail = JSON.parse((await get("owner", `/projects/${projectId}`)).text);
    expect(detail.workspace.path).toContain(dataDir());
    expect(detail.project.source_path).toBe(source);
  });

  for (const role of ["operator", "viewer"]) {
    it(`${role}s get no absolute path, data directory or process id anywhere`, async () => {
      for (const path of endpoints()) {
        const r = await get(role, path);
        expect(r.status, path).toBe(200);
        expect(leaks(r.text), `${role} ${path}`).toEqual([]);
      }
      const status = JSON.parse((await get(role, "/status")).text);
      expect(status.dataDir).toBe("(hidden)");
      expect(status.worker.owner).toBe("(hidden)");
      const detail = JSON.parse((await get(role, `/projects/${projectId}`)).text);
      expect(detail.workspace.path).toBe("(hidden)");
      expect(detail.project.source_path).toBe("(hidden)");
      const ev = JSON.parse((await get(role, "/evidence")).text).find(
        (e: { id: string }) => e.id === evidenceId,
      );
      expect(ev.output_path).toBe("(hidden)");
      expect(ev.output_tail).toMatch(/<vala-data>/);
    });
  }

  it("keeps relative paths so the file browser still works for viewers", async () => {
    const files = JSON.parse((await get("viewer", `/projects/${projectId}/files`)).text);
    expect(files).toContain("README.md");
    const file = JSON.parse(
      (await get("viewer", `/projects/${projectId}/file?path=README.md`)).text,
    );
    // Git on Windows may check the file out with CRLF line endings.
    expect(file.content.replace(/\r\n/g, "\n")).toBe("# hello\n");
    expect(file.path).toBe("README.md");
  });

  it("does not let anonymous callers in at all", async () => {
    expect((await get("nobody", "/status")).status).toBe(401);
  });
});
