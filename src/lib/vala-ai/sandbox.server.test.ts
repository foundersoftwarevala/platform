// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handleApi } from "./api.server.ts";
import type { Operator } from "./auth.server.ts";
import { closeDb } from "./db.server.ts";
import { runCommand } from "./exec.server.ts";
import {
  approveRequirement,
  checksOf,
  createProject,
  getRequirement,
  saveDraft,
} from "./projects.server.ts";
import { containerName, dockerProblem, dockerRunArgs, sandboxPolicy } from "./sandbox.server.ts";
import { createTask, runCheck } from "./tasks.server.ts";
import {
  deleteWorkspaceFile,
  readWorkspaceFile,
  requireReadyWorkspace,
  writeWorkspaceFile,
} from "./workspace.server.ts";

const root = mkdtempSync(join(tmpdir(), "vala-sandbox-"));
process.env.VALA_AI_DATA_DIR = join(root, "data");
process.env.VALA_AI_WORKER = "off";
const owner: Operator = { id: "u-owner", email: "o@test.local", name: "o", role: "owner" };
const IMAGE = "node:22-bookworm-slim@sha256:" + "a".repeat(64);
const restoreEnv = { ...process.env };

afterAll(() => {
  process.env = restoreEnv;
  closeDb();
  rmSync(root, { recursive: true, force: true });
});

describe("sandbox policy", () => {
  it("is off in development and docker in production", () => {
    expect(sandboxPolicy({ NODE_ENV: "development" }).mode).toBe("off");
    expect(sandboxPolicy({ NODE_ENV: "production" }).mode).toBe("docker");
    expect(sandboxPolicy({ NODE_ENV: "development", VALA_AI_SANDBOX: "docker" }).mode).toBe(
      "docker",
    );
  });

  it("refuses to be switched off in production without an explicit override", () => {
    expect(() => sandboxPolicy({ NODE_ENV: "production", VALA_AI_SANDBOX: "off" })).toThrow(
      /not allowed in production/,
    );
    expect(
      sandboxPolicy({
        NODE_ENV: "production",
        VALA_AI_SANDBOX: "off",
        VALA_AI_SANDBOX_ALLOW_OFF_IN_PRODUCTION: "yes",
      }).mode,
    ).toBe("off");
  });

  it("rejects unknown modes, root users and out-of-range limits", () => {
    expect(() => sandboxPolicy({ VALA_AI_SANDBOX: "maybe" })).toThrow(/"off" or "docker"/);
    expect(() => sandboxPolicy({ VALA_AI_SANDBOX_USER: "0:0" })).toThrow(/not root/);
    expect(() => sandboxPolicy({ VALA_AI_SANDBOX_MEMORY_MB: "64" })).toThrow(/between 128/);
  });

  it("requires an image pinned by digest, and Docker itself", () => {
    expect(dockerProblem({ ...sandboxPolicy({ VALA_AI_SANDBOX: "docker" }), image: null })).toMatch(
      /not set/,
    );
    expect(
      dockerProblem({ ...sandboxPolicy({ VALA_AI_SANDBOX: "docker" }), image: "node:22" }),
    ).toMatch(/pinned by digest/);
    const p = sandboxPolicy({
      VALA_AI_SANDBOX: "docker",
      VALA_AI_SANDBOX_IMAGE: IMAGE,
      VALA_AI_DOCKER_BIN: "vala-no-such-docker",
    });
    expect(dockerProblem(p)).toMatch(/Docker is not available/);
  });
});

describe("docker run arguments", () => {
  const p = sandboxPolicy({ VALA_AI_SANDBOX: "docker", VALA_AI_SANDBOX_IMAGE: IMAGE });
  const args = dockerRunArgs(["npm", "test"], "/srv/ws/VP-1", p, "vala-ai-ev-x");
  const pair = (flag: string) => args[args.indexOf(flag) + 1];

  it("applies every control in the design", () => {
    expect(args.slice(0, 2)).toEqual(["run", "--rm"]);
    expect(pair("--network")).toBe("none");
    expect(args).toContain("--read-only");
    expect(pair("--user")).toBe("10001:10001");
    expect(pair("--cap-drop")).toBe("ALL");
    expect(pair("--security-opt")).toBe("no-new-privileges");
    expect(pair("--pids-limit")).toBe("256");
    expect(pair("--memory")).toBe("1024m");
    expect(pair("--memory-swap")).toBe("1024m");
    expect(pair("--cpus")).toBe("1");
    expect(args).toContain("--init");
    expect(pair("--label")).toBe("vala-ai=1");
    expect(pair("--tmpfs")).toMatch(/^\/tmp:rw,size=256m,noexec,nosuid,nodev$/);
  });

  it("mounts only this workspace, with .git read-only", () => {
    const mounts = args.filter((_, i) => args[i - 1] === "--mount");
    expect(mounts).toHaveLength(2);
    expect(mounts[0]).toBe("type=bind,source=/srv/ws/VP-1,target=/work");
    expect(mounts[1]).toMatch(/source=.*VP-1[\\/]\.git,target=\/work\/\.git,readonly$/);
    expect(args.join(" ")).not.toMatch(/--privileged|--network host|-v \/:|docker\.sock/);
  });

  it("passes no host environment and no shell", () => {
    const env = args.filter((_, i) => args[i - 1] === "--env");
    expect(env).toEqual([
      "CI=1",
      "NO_COLOR=1",
      "HOME=/tmp",
      "npm_config_cache=/tmp/.npm",
      "npm_config_update_notifier=false",
    ]);
    expect(args.slice(args.indexOf(IMAGE))).toEqual([IMAGE, "npm", "test"]);
  });

  it("names containers from the evidence id", () => {
    expect(containerName("EV-ABC123")).toBe("vala-ai-ev-abc123");
  });
});

describe("checks under the policy", () => {
  let task: ReturnType<typeof createTask>;
  beforeAll(() => {
    const p = createProject({ name: "Sandbox", sourceKind: "empty" }, owner);
    writeFileSync(
      join(requireReadyWorkspace(p.project.id).path, "check.mjs"),
      "console.log('ok')\n",
    );
    const d = saveDraft(
      p.project.id,
      { title: "t", body: "b", checks: [{ label: "c", command: "node check.mjs" }] },
      owner,
    );
    approveRequirement(d.id, owner);
    task = createTask(p.project.id, { title: "t", instruction: "i" }, owner);
  });

  it("records that a check ran without isolation when the sandbox is off", async () => {
    process.env.VALA_AI_SANDBOX = "off";
    const ev = await runCheck(
      task,
      requireReadyWorkspace(task.project_id),
      checksOf(getRequirement(task.requirement_id))[0],
      "agent",
    );
    expect(ev.sandbox).toBe("none");
    expect(ev.verdict).toBe("pass");
    expect(readFileSync(ev.output_path, "utf8")).toMatch(/^# sandbox none$/m);
  });

  it("refuses the check, instead of running it on this machine, when the sandbox is required but unavailable", async () => {
    process.env.VALA_AI_SANDBOX = "docker";
    process.env.VALA_AI_SANDBOX_IMAGE = IMAGE;
    process.env.VALA_AI_DOCKER_BIN = "vala-no-such-docker";
    const ev = await runCheck(
      task,
      requireReadyWorkspace(task.project_id),
      checksOf(getRequirement(task.requirement_id))[0],
      "verifier",
    );
    expect(ev.sandbox).toBe("refused");
    expect(ev.exit_code).toBe(126);
    expect(ev.verdict).toBe("fail");
    expect(readFileSync(ev.output_path, "utf8")).toMatch(
      /must run in the sandbox.*Docker is not available/,
    );
  });

  it("reports the sandbox state in system status", async () => {
    const res = await handleApi(
      new Request("http://localhost/api/vala-ai/status"),
      async () => owner,
    );
    const status = await res.json();
    expect(status.sandbox).toMatchObject({ mode: "docker", ready: false });
    expect(
      status.capabilities.find((c: { area: string }) => c.area === "OS-level sandbox for checks")
        .status,
    ).toBe("not active");
    process.env.VALA_AI_SANDBOX = "off";
  });
});

/*
 * The design's security acceptance tests. They need Docker and a pinned image
 * (VALA_AI_SANDBOX_IMAGE) on the machine running the tests, so they run on the
 * server, not on a development machine without Docker.
 */
const dockerReady =
  spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    encoding: "utf8",
    timeout: 8000,
  }).status === 0 && Boolean(restoreEnv.VALA_AI_SANDBOX_IMAGE);
if (!dockerReady)
  console.warn(
    "[sandbox] Docker or VALA_AI_SANDBOX_IMAGE not available here: container acceptance tests skipped.",
  );

describe.skipIf(!dockerReady)("container acceptance tests (need Docker)", () => {
  const policy = () =>
    sandboxPolicy({
      VALA_AI_SANDBOX: "docker",
      VALA_AI_SANDBOX_IMAGE: restoreEnv.VALA_AI_SANDBOX_IMAGE,
    });
  let ws: string;
  beforeAll(() => {
    const previous = process.env.VALA_AI_SANDBOX;
    process.env.VALA_AI_SANDBOX = "docker";
    try {
      const project = createProject({ name: "Sandbox acceptance", sourceKind: "empty" }, owner);
      ws = requireReadyWorkspace(project.project.id).path;
    } finally {
      if (previous === undefined) delete process.env.VALA_AI_SANDBOX;
      else process.env.VALA_AI_SANDBOX = previous;
    }
  });
  const run = (code: string, timeoutMs = 60_000) =>
    runCommand(["node", "-e", code], {
      cwd: ws,
      timeoutMs,
      maxOutputBytes: 8192,
      sandbox: { policy: policy(), name: `vala-ai-acc-${Date.now()}` },
    });

  it("1. cannot read host files outside the workspace", async () => {
    const secret = join(tmpdir(), `vala-host-secret-${Date.now()}.env`);
    writeFileSync(secret, "TOKEN=host-only");
    try {
      const r = await run(`require('fs').readFileSync(${JSON.stringify(secret)}, 'utf8')`);
      expect(r.exitCode).not.toBe(0);
      expect(r.output).not.toContain("host-only");
    } finally {
      rmSync(secret);
    }
  });
  it("2. sees only the container filesystem at /", async () => {
    const r = await run("console.log(require('fs').readdirSync('/').join(','))");
    expect(r.output).toMatch(/work/);
    expect(r.output).not.toMatch(/Users|var\/www/);
  });
  it("3. has no network", async () => {
    const r = await run(
      "require('https').get('https://registry.npmjs.org', () => process.exit(0)).on('error', () => process.exit(3))",
    );
    expect(r.exitCode).toBe(3);
  });
  it("4. is stopped by the process limit", async () => {
    const r = await run(
      "const cp=require('child_process');const children=[];function stop(code){for(const c of children)c.kill();process.exit(code)}function next(){if(children.length>=512)return stop(6);const c=cp.spawn('sleep',['60']);c.once('spawn',()=>{children.push(c);setImmediate(next)});c.once('error',e=>{console.log(e.code,'after',children.length);stop(e.code==='EAGAIN'?4:5)})}next()",
      30_000,
    );
    expect(r.timedOut).toBe(false);
    expect(r.exitCode).toBe(4);
    const stoppedAt = Number(r.output.match(/EAGAIN after (\d+)/)?.[1]);
    expect(stoppedAt).toBeGreaterThan(0);
    expect(stoppedAt).toBeLessThan(256);
  });
  it("5. is killed when it exceeds the memory limit", async () => {
    const r = await run("const a=[];for(;;)a.push(Buffer.alloc(64*1024*1024,1))", 120_000);
    expect(r.timedOut).toBe(false);
    expect(r.exitCode).toBe(137);
  });
  it("6. is killed at the timeout and leaves no container behind", async () => {
    const name = `vala-ai-acc-timeout-${Date.now()}`;
    const r = await runCommand(["node", "-e", "setTimeout(()=>{},600000)"], {
      cwd: ws,
      timeoutMs: 5000,
      maxOutputBytes: 1024,
      sandbox: { policy: policy(), name },
    });
    expect(r.timedOut).toBe(true);
    const ps = spawnSync(
      "docker",
      ["ps", "-a", "--filter", `name=${name}`, "--format", "{{.ID}}"],
      { encoding: "utf8" },
    );
    expect(ps.stdout.trim()).toBe("");
  });
  it("7. cannot write .git or the root filesystem", async () => {
    const git = await run("require('fs').writeFileSync('/work/.git/hooks/pre-commit','x')");
    expect(git.exitCode).not.toBe(0);
    const etc = await run("require('fs').writeFileSync('/etc/vala','x')");
    expect(etc.exitCode).not.toBe(0);
  });
  it("can edit host-created content and new nested files without sharing .git ownership", async () => {
    const previous = process.env.VALA_AI_SANDBOX;
    process.env.VALA_AI_SANDBOX = "docker";
    try {
      const project = createProject(
        { name: "Sandbox writable content", sourceKind: "empty" },
        owner,
      );
      const workspace = requireReadyWorkspace(project.project.id);
      writeWorkspaceFile(workspace, "nested/host.txt", "host\n");
      expect(statSync(workspace.path).gid).toBe(10001);
      expect(statSync(join(workspace.path, "nested/host.txt")).gid).toBe(10001);
      expect(statSync(join(workspace.path, ".git")).gid).not.toBe(10001);
      const result = await runCommand(
        [
          "node",
          "-e",
          "const fs=require('fs');fs.appendFileSync('/work/nested/host.txt','sandbox\\n');fs.mkdirSync('/work/nested/created');fs.writeFileSync('/work/nested/created/result.txt','ok');",
        ],
        {
          cwd: workspace.path,
          timeoutMs: 60_000,
          maxOutputBytes: 8192,
          sandbox: { policy: policy(), name: `vala-ai-acc-write-${Date.now()}` },
        },
      );
      expect(result.exitCode).toBe(0);
      expect(readFileSync(join(workspace.path, "nested/host.txt"), "utf8")).toBe("host\nsandbox\n");
      expect(readFileSync(join(workspace.path, "nested/created/result.txt"), "utf8")).toBe("ok");
      writeWorkspaceFile(workspace, "nested/created/result.txt", "host again");
      expect(readFileSync(join(workspace.path, "nested/created/result.txt"), "utf8")).toBe(
        "host again",
      );
      expect(readWorkspaceFile(workspace, "nested/created/result.txt").content).toBe("host again");
      symlinkSync("result.txt", join(workspace.path, "nested/created/link.txt"));
      expect(readWorkspaceFile(workspace, "nested/created/link.txt").content).toBe("host again");
      expect(() => writeWorkspaceFile(workspace, "nested/created/link.txt", "blocked")).toThrow(
        /ELOOP/,
      );
      deleteWorkspaceFile(workspace, "nested/created/link.txt");
      expect(readWorkspaceFile(workspace, "nested/created/result.txt").content).toBe("host again");
      writeWorkspaceFile(workspace, "nested/created/file (deleted)", "ordinary filename");
      expect(readWorkspaceFile(workspace, "nested/created/file (deleted)").content).toBe(
        "ordinary filename",
      );
      deleteWorkspaceFile(workspace, "nested/created/file (deleted)");
    } finally {
      if (previous === undefined) delete process.env.VALA_AI_SANDBOX;
      else process.env.VALA_AI_SANDBOX = previous;
    }
  });
});
