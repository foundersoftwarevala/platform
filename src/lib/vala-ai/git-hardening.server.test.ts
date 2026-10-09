// @vitest-environment node
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Operator } from "./auth.server.ts";
import { closeDb, one } from "./db.server.ts";
import { createProject } from "./projects.server.ts";
import { checkpoint, isClean, requireReadyWorkspace, type Workspace } from "./workspace.server.ts";

/*
 * Project code (a check, an install script) can write .git/hooks or
 * .git/config inside a workspace. Git would then run those commands on this
 * host the next time Vala AI commits or reads status. Each test has a control
 * showing that plain git on this machine does run them.
 */

const root = mkdtempSync(join(tmpdir(), "vala-githard-"));
process.env.VALA_AI_DATA_DIR = join(root, "data");
process.env.VALA_AI_WORKER = "off";
const owner: Operator = { id: "u-owner", email: "o@test.local", name: "o", role: "owner" };
let ws: Workspace;

const plainGit = (cwd: string, ...args: string[]) =>
  spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
    cwd,
    encoding: "utf8",
  });
const hook = (dir: string, marker: string) => {
  const hooks = join(dir, ".git", "hooks");
  mkdirSync(hooks, { recursive: true });
  const file = join(hooks, "pre-commit");
  writeFileSync(file, `#!/bin/sh\necho ran > "${marker.replace(/\\/g, "/")}"\n`);
  chmodSync(file, 0o755);
};

beforeAll(() => {
  const p = createProject({ name: "Git hardening", sourceKind: "empty" }, owner);
  ws = requireReadyWorkspace(p.project.id);
});

afterAll(() => {
  closeDb();
  rmSync(root, { recursive: true, force: true });
});

describe("git run by Vala AI on the host", () => {
  it("records the workspace's git config hash when the workspace is created", () => {
    const row = one<{ git_config_sha256: string | null }>(
      "select git_config_sha256 from workspaces where id = ?",
      ws.id,
    );
    expect(row?.git_config_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("control: plain git on this machine runs a pre-commit hook", () => {
    const repo = join(root, "control-hook");
    mkdirSync(repo);
    plainGit(repo, "init", "--quiet");
    const marker = join(root, "control-hook-ran.txt");
    hook(repo, marker);
    writeFileSync(join(repo, "a.txt"), "a");
    plainGit(repo, "add", "-A");
    plainGit(repo, "commit", "--quiet", "-m", "c");
    expect(existsSync(marker)).toBe(true);
  });

  it("does not run a hook planted in the workspace", () => {
    const marker = join(root, "workspace-hook-ran.txt");
    hook(ws.path, marker);
    writeFileSync(join(ws.path, "b.txt"), "b");
    checkpoint(ws, "after a planted hook", null, owner.id);
    expect(existsSync(marker)).toBe(false);
  });

  it("control: plain git on this machine runs a configured fsmonitor command", () => {
    const repo = join(root, "control-fsmonitor");
    mkdirSync(repo);
    plainGit(repo, "init", "--quiet");
    const marker = join(root, "control-fsmonitor-ran.txt").replace(/\\/g, "/");
    plainGit(repo, "config", "core.fsmonitor", `echo ran > "${marker}"`);
    plainGit(repo, "status", "--porcelain");
    expect(existsSync(marker)).toBe(true);
  });

  it("refuses to run git in a workspace whose config was changed, and runs nothing from it", () => {
    const marker = join(root, "workspace-fsmonitor-ran.txt").replace(/\\/g, "/");
    plainGit(ws.path, "config", "core.fsmonitor", `echo ran > "${marker}"`);
    const fresh = requireReadyWorkspace(ws.project_id);
    expect(() => isClean(fresh)).toThrow(/git configuration was changed outside Vala AI/);
    expect(existsSync(marker)).toBe(false);
    const audited = one<{ n: number }>(
      "select count(*) as n from audit_log where action = 'workspace.git_config_tampered'",
    );
    expect(audited?.n).toBeGreaterThan(0);
  });
});
