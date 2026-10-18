import {
  closeSync,
  constants,
  existsSync,
  fchmodSync,
  fchownSync,
  fstatSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
  type Stats,
} from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { audit } from "./audit.server.ts";
import { dataDir, paths } from "./config.server.ts";
import { one, run } from "./db.server.ts";
import { git } from "./exec.server.ts";
import { sandboxPolicy } from "./sandbox.server.ts";
import { getSettings, resources } from "./settings.server.ts";
import { newId, now, sha256, ValaError } from "./util.server.ts";

/**
 * Isolated project workspaces.
 *
 * A project that starts from existing code names a local git repository as its
 * source. The workspace is a full `git clone --no-hardlinks` of it under the
 * data directory, so the agent's edits, checkpoints and rollbacks happen in a
 * separate copy with its own object store. Against the source itself only
 * read-only git commands are ever run (rev-parse, count-objects, and the clone
 * read). Every file path the agent supplies is resolved inside the workspace,
 * and `.git` is out of reach.
 */

export type Workspace = {
  git_config_sha256?: string | null;
  id: string;
  project_id: string;
  path: string;
  base_commit: string | null;
  status: "creating" | "ready" | "failed";
  error: string | null;
  created_at: string;
};

const GIT_IDENTITY = [
  "-c",
  "user.name=Vala AI",
  "-c",
  "user.email=vala-ai@localhost",
  "-c",
  "commit.gpgsign=false",
];

function sandboxWorkspaceGid(): number | null {
  const policy = sandboxPolicy();
  if (policy.mode !== "docker") return null;
  if (process.platform !== "linux")
    throw new ValaError(500, "Docker workspace permissions require a Linux host.");
  return Number(policy.user.split(":")[1]);
}

function checkWorkspaceFd(root: string, fd: number): Stats {
  const opened = readlinkSync(`/proc/self/fd/${fd}`);
  const rel = relative(realpathSync(root), opened);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel) || rel.split(sep)[0] === ".git")
    throw new ValaError(403, "Sandbox permissions may only change workspace content.");
  const stat = fstatSync(fd);
  if (
    (!stat.isDirectory() && !stat.isFile()) ||
    stat.nlink === 0 ||
    (stat.isFile() && stat.nlink !== 1)
  )
    throw new ValaError(403, "Sandbox sharing refuses special files and hard links.");
  return stat;
}

function shareWorkspaceFd(root: string, fd: number, gid: number): void {
  const stat = checkWorkspaceFd(root, fd);
  // Keep the host owner for Git; share only content with the sandbox group.
  fchownSync(fd, -1, gid);
  fchmodSync(fd, stat.isDirectory() ? 0o2770 : stat.mode & 0o111 ? 0o770 : 0o660);
}

function withWorkspaceParent<T>(
  root: string,
  abs: string,
  create: boolean,
  gid: number | null,
  operation: (target: string) => T,
): T {
  const directory = realTarget(dirname(abs));
  if (directory === null)
    throw new ValaError(403, "File operation escaped editable workspace content.");
  const canonical = resolve(directory, basename(abs));
  const base = realpathSync(root);
  const rel = relative(base, canonical);
  if (
    rel === "" ||
    rel === ".." ||
    rel.startsWith(`..${sep}`) ||
    isAbsolute(rel) ||
    [".git", "node_modules"].includes(rel.split(sep)[0])
  )
    throw new ValaError(403, "File operation escaped editable workspace content.");
  let parent = openSync(base, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    if (gid !== null) shareWorkspaceFd(base, parent, gid);
    else checkWorkspaceFd(base, parent);
    for (const part of rel.split(sep).slice(0, -1)) {
      const child = `/proc/self/fd/${parent}/${part}`;
      if (create) {
        try {
          mkdirSync(child);
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
        }
      }
      const next = openSync(
        child,
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      );
      closeSync(parent);
      parent = next;
      if (gid !== null) shareWorkspaceFd(base, parent, gid);
      else checkWorkspaceFd(base, parent);
    }
    // Hold the parent inode, rather than re-traversing container-writable ancestors.
    return operation(`/proc/self/fd/${parent}/${basename(canonical)}`);
  } finally {
    closeSync(parent);
  }
}

function readWorkspaceBytes(root: string, abs: string): Buffer {
  const canonical = realTarget(abs);
  if (canonical === null)
    throw new ValaError(403, "File operation escaped editable workspace content.");
  return withWorkspaceParent(root, canonical, false, null, (target) => {
    const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      if (!checkWorkspaceFd(root, fd).isFile())
        throw new ValaError(404, "Workspace file not found.");
      return readFileSync(fd);
    } finally {
      closeSync(fd);
    }
  });
}

function shareWorkspacePath(root: string, path: string, gid: number): void {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    shareWorkspaceFd(root, fd, gid);
  } finally {
    closeSync(fd);
  }
}

function shareCreatedWorkspace(root: string, gid: number): void {
  const walk = (path: string) => {
    shareWorkspacePath(root, path, gid);
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.isSymbolicLink()) continue;
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) walk(child);
      else shareWorkspacePath(root, child, gid);
    }
  };
  walk(root);
}

export function getWorkspace(projectId: string): Workspace | undefined {
  return one<Workspace>("select * from workspaces where project_id = ?", projectId);
}

export function requireReadyWorkspace(projectId: string): Workspace {
  const ws = getWorkspace(projectId);
  if (!ws) throw new ValaError(409, "This project has no workspace yet.");
  if (ws.status !== "ready")
    throw new ValaError(409, `Workspace is ${ws.status}${ws.error ? `: ${ws.error}` : ""}.`);
  return ws;
}

/** Validates a source repository without writing to it. */
export function inspectSource(sourcePath: string): { root: string; head: string; sizeKb: number } {
  if (!isAbsolute(sourcePath)) throw new ValaError(400, "Source path must be absolute.");
  const abs = resolve(sourcePath);
  if (!existsSync(abs) || !statSync(abs).isDirectory())
    throw new ValaError(400, "Source path does not exist or is not a directory.");
  const inData = relative(dataDir(), abs);
  if (!inData.startsWith("..") && !isAbsolute(inData))
    throw new ValaError(400, "Source path may not be inside the Vala AI data directory.");
  const top = git(abs, ["rev-parse", "--show-toplevel"]);
  if (!top.ok) throw new ValaError(400, "Source path is not inside a git repository.");
  const head = git(abs, ["rev-parse", "HEAD"]);
  if (!head.ok) throw new ValaError(400, "Source repository has no commits.");
  const count = git(abs, ["count-objects", "-v"]);
  const kb = (key: string) =>
    Number(count.stdout.match(new RegExp(`^${key}: (\\d+)`, "m"))?.[1] ?? 0);
  return {
    root: resolve(top.stdout.trim()),
    head: head.stdout.trim(),
    sizeKb: kb("size") + kb("size-pack"),
  };
}

export function createWorkspace(
  projectId: string,
  source: { kind: "git" | "empty"; path: string | null },
  actor: string,
): Workspace {
  if (getWorkspace(projectId)) throw new ValaError(409, "Workspace already exists.");
  const wsPath = resolve(paths.workspaces(), projectId);
  const id = newId("W", 8);
  run(
    "insert into workspaces (id, project_id, path, status, created_at) values (?,?,?,?,?)",
    id,
    projectId,
    wsPath,
    "creating",
    now(),
  );

  const fail = (message: string): never => {
    run("update workspaces set status = 'failed', error = ? where id = ?", message, id);
    audit(actor, "workspace.create_failed", "workspace", id, { projectId, message });
    throw new ValaError(500, message);
  };

  const res = resources();
  if (!res.ok) fail(`Resource limits: ${res.problems.join(" ")}`);
  mkdirSync(paths.workspaces(), { recursive: true });
  if (existsSync(wsPath)) fail("Workspace directory already exists on disk.");

  if (source.kind === "git") {
    const info = inspectSource(source.path ?? "");
    const neededGb = (info.sizeKb * 3) / 1024 / 1024; // clone + checkout headroom
    if (res.freeDiskGb - neededGb < getSettings().min_free_disk_gb)
      fail(`Not enough disk: the source needs about ${neededGb.toFixed(2)} GB.`);
    const clone = git(paths.workspaces(), [
      "clone",
      "--no-hardlinks",
      "--quiet",
      info.root,
      wsPath,
    ]);
    if (!clone.ok) fail(`git clone failed: ${clone.stderr.trim().slice(0, 500)}`);
  } else {
    mkdirSync(wsPath, { recursive: true });
    const init = git(wsPath, ["init", "--quiet"]);
    if (!init.ok) fail(`git init failed: ${init.stderr.trim()}`);
    writeFileSync(resolve(wsPath, "README.md"), "# Project workspace\n");
    git(wsPath, ["add", "-A"]);
    const commit = git(wsPath, [...GIT_IDENTITY, "commit", "--quiet", "-m", "Workspace created"]);
    if (!commit.ok) fail(`initial commit failed: ${commit.stderr.trim()}`);
  }

  const head = git(wsPath, ["rev-parse", "HEAD"]);
  if (!head.ok) fail("Workspace has no HEAD commit.");
  try {
    const gid = sandboxWorkspaceGid();
    if (gid !== null) shareCreatedWorkspace(wsPath, gid);
  } catch (error) {
    fail(
      `Sandbox workspace permissions failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  run(
    "update workspaces set status = 'ready', base_commit = ?, error = null, git_config_sha256 = ? where id = ?",
    head.stdout.trim(),
    gitConfigHash(wsPath),
    id,
  );
  audit(actor, "workspace.create", "workspace", id, {
    projectId,
    kind: source.kind,
    source: source.path,
    base: head.stdout.trim(),
  });
  return getWorkspace(projectId)!;
}

function gitConfigHash(wsPath: string): string | null {
  const file = resolve(wsPath, ".git", "config");
  return existsSync(file) ? sha256(readFileSync(file)) : null;
}

/**
 * Git inside a workspace. Its .git/config was hashed when Vala AI created the
 * workspace; if project code has since changed it (a filter, diff driver,
 * fsmonitor or alias that git would execute), git is not run there at all.
 * Workspaces created before this check record their hash on first use.
 */
function wsGit(ws: Workspace, args: string[]) {
  const current = gitConfigHash(ws.path);
  if (!ws.git_config_sha256) {
    run("update workspaces set git_config_sha256 = ? where id = ?", current, ws.id);
    ws.git_config_sha256 = current;
  } else if (current !== ws.git_config_sha256) {
    audit("vala-ai", "workspace.git_config_tampered", "workspace", ws.id, {
      projectId: ws.project_id,
    });
    throw new ValaError(
      409,
      "This workspace's git configuration was changed outside Vala AI (for example by a check or an install script). Git will not run in it; roll the workspace back or recreate it.",
    );
  }
  return git(ws.path, args);
}

/** Resolves an agent- or operator-supplied path strictly inside the workspace. */
export function resolveInside(ws: Workspace, rel: string): string {
  const clean = rel.replace(/\\/g, "/").trim();
  if (!clean || isAbsolute(clean) || /^[A-Za-z]:/.test(clean))
    throw new ValaError(400, `Path "${rel}" must be relative to the workspace.`);
  const abs = resolve(ws.path, clean);
  const r = relative(ws.path, abs);
  if (r === "" || r.startsWith("..") || isAbsolute(r))
    throw new ValaError(400, `Path "${rel}" is outside the workspace.`);
  const first = r.split(sep)[0];
  if (first === ".git" || first === "node_modules")
    throw new ValaError(400, `Path "${rel}" is not editable.`);

  // The lexical check above cannot see symlinks or junctions committed to the
  // repository (or created by a check). Resolve where the path really leads,
  // through every link that exists along it, and hold that to the same rules.
  const root = realpathSync(ws.path);
  const real = realTarget(abs);
  const rr = real === null ? null : relative(root, real);
  if (rr === null || rr === "" || rr.startsWith("..") || isAbsolute(rr))
    throw new ValaError(400, `Path "${rel}" leads outside the workspace through a link.`);
  const realFirst = rr.split(sep)[0];
  if (realFirst === ".git" || realFirst === "node_modules")
    throw new ValaError(
      400,
      `Path "${rel}" leads into a part of the workspace that is not editable.`,
    );
  return abs;
}

/**
 * Where a path really points: the real path of its deepest existing ancestor
 * (every symlink and junction on the way resolved) with the not-yet-existing
 * remainder appended. A dangling link cannot be resolved and returns null, so
 * a write can never create a file at a link's hidden target.
 */
function realTarget(abs: string): string | null {
  const rest: string[] = [];
  let current = abs;
  for (;;) {
    let exists = true;
    try {
      lstatSync(current);
    } catch {
      exists = false;
    }
    if (exists) {
      try {
        return resolve(realpathSync(current), ...rest);
      } catch {
        return null;
      }
    }
    const parent = dirname(current);
    if (parent === current) return resolve(current, ...rest);
    rest.unshift(basename(current));
    current = parent;
  }
}

export function listFiles(ws: Workspace, limit = 4000): string[] {
  const tracked = wsGit(ws, ["ls-files", "-z"]);
  const untracked = wsGit(ws, ["ls-files", "-z", "--others", "--exclude-standard"]);
  const files = new Set(
    [...tracked.stdout.split("\0"), ...untracked.stdout.split("\0")].filter(Boolean),
  );
  return [...files].sort().slice(0, limit);
}

export function readWorkspaceFile(
  ws: Workspace,
  rel: string,
  maxBytes = getSettings().max_file_kb * 1024,
): { path: string; content: string; bytes: number; truncated: boolean } {
  const abs = resolveInside(ws, rel);
  if (!existsSync(abs) || !statSync(abs).isFile())
    throw new ValaError(404, `File "${rel}" not found.`);
  const buf = process.platform === "linux" ? readWorkspaceBytes(ws.path, abs) : readFileSync(abs);
  if (buf.includes(0)) throw new ValaError(415, `File "${rel}" is binary.`);
  const truncated = buf.length > maxBytes;
  return {
    path: rel,
    content: buf.subarray(0, maxBytes).toString("utf8"),
    bytes: buf.length,
    truncated,
  };
}

export function writeWorkspaceFile(
  ws: Workspace,
  rel: string,
  content: string,
): { path: string; beforeSha: string | null; afterSha: string; bytes: number } {
  const abs = resolveInside(ws, rel);
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > getSettings().max_file_kb * 1024)
    throw new ValaError(413, `File "${rel}" exceeds the ${getSettings().max_file_kb} KB limit.`);
  const gid = sandboxWorkspaceGid();
  const write = (target: string) => {
    const flags = constants.O_RDWR | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
    let created = true;
    let fd: number;
    try {
      fd = openSync(target, flags | constants.O_CREAT | constants.O_EXCL, 0o644);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      created = false;
      fd = openSync(target, flags);
    }
    try {
      if (process.platform === "linux") checkWorkspaceFd(ws.path, fd);
      if (gid !== null) shareWorkspaceFd(ws.path, fd, gid);
      const beforeSha = created ? null : sha256(readFileSync(fd));
      ftruncateSync(fd, 0);
      writeSync(fd, content, 0, "utf8");
      return beforeSha;
    } finally {
      closeSync(fd);
    }
  };
  let beforeSha: string | null;
  if (process.platform === "linux") beforeSha = withWorkspaceParent(ws.path, abs, true, gid, write);
  else {
    mkdirSync(dirname(abs), { recursive: true });
    beforeSha = write(abs);
  }
  return { path: rel, beforeSha, afterSha: sha256(content), bytes };
}

export function deleteWorkspaceFile(
  ws: Workspace,
  rel: string,
): { path: string; beforeSha: string } {
  const abs = resolveInside(ws, rel);
  if (!existsSync(abs)) throw new ValaError(404, `File "${rel}" not found.`);
  const remove = (target: string) => {
    const beforeSha = sha256(
      process.platform === "linux" ? readWorkspaceBytes(ws.path, target) : readFileSync(target),
    );
    rmSync(target);
    return beforeSha;
  };
  const beforeSha =
    process.platform === "linux"
      ? withWorkspaceParent(ws.path, abs, false, null, remove)
      : remove(abs);
  return { path: rel, beforeSha };
}

export function headCommit(ws: Workspace): string {
  const r = wsGit(ws, ["rev-parse", "HEAD"]);
  if (!r.ok) throw new ValaError(500, "Workspace HEAD unreadable.");
  return r.stdout.trim();
}

export function isClean(ws: Workspace): boolean {
  return wsGit(ws, ["status", "--porcelain"]).stdout.trim() === "";
}

export function changedFiles(ws: Workspace): { status: string; path: string }[] {
  return wsGit(ws, ["status", "--porcelain"])
    .stdout.split("\n")
    .filter(Boolean)
    .map((l) => ({ status: l.slice(0, 2).trim(), path: l.slice(3) }));
}

/** Commits everything in the workspace and records a checkpoint. */
export function checkpoint(
  ws: Workspace,
  label: string,
  taskId: string | null,
  actor: string,
): { id: string; sha: string } {
  wsGit(ws, ["add", "-A"]);
  const commit = wsGit(ws, [...GIT_IDENTITY, "commit", "--quiet", "--allow-empty", "-m", label]);
  if (!commit.ok)
    throw new ValaError(500, `Checkpoint commit failed: ${commit.stderr.trim().slice(0, 300)}`);
  const sha = headCommit(ws);
  const id = newId("CP", 8);
  run(
    "insert into checkpoints (id, task_id, project_id, label, commit_sha, created_at) values (?,?,?,?,?,?)",
    id,
    taskId,
    ws.project_id,
    label,
    sha,
    now(),
  );
  audit(actor, "workspace.checkpoint", "workspace", ws.id, { sha, label, taskId });
  return { id, sha };
}

export function commitExists(ws: Workspace, sha: string): boolean {
  return /^[0-9a-f]{7,64}$/.test(sha) && wsGit(ws, ["cat-file", "-e", `${sha}^{commit}`]).ok;
}

/** Destructive inside the workspace only; callers gate it behind an approval. */
export function resetWorkspace(ws: Workspace, sha: string) {
  if (!commitExists(ws, sha)) throw new ValaError(400, "Unknown commit.");
  const reset = wsGit(ws, ["reset", "--hard", "--quiet", sha]);
  const clean = wsGit(ws, ["clean", "-fd", "--quiet"]);
  if (!reset.ok || !clean.ok)
    throw new ValaError(
      500,
      `Rollback failed: ${(reset.stderr + clean.stderr).trim().slice(0, 300)}`,
    );
}

export function diffBetween(
  ws: Workspace,
  from: string,
  to: string,
  maxBytes = 400_000,
): { diff: string; truncated: boolean; stat: string } {
  if (!commitExists(ws, from) || !commitExists(ws, to)) throw new ValaError(400, "Unknown commit.");
  const d = wsGit(ws, ["diff", "--no-color", "--no-ext-diff", "--no-textconv", from, to]);
  const stat = wsGit(ws, [
    "diff",
    "--stat",
    "--no-color",
    "--no-ext-diff",
    "--no-textconv",
    from,
    to,
  ]).stdout;
  return { diff: d.stdout.slice(0, maxBytes), truncated: d.stdout.length > maxBytes, stat };
}

export function changedPathsBetween(ws: Workspace, from: string, to: string): string[] {
  if (!commitExists(ws, from) || !commitExists(ws, to)) throw new ValaError(400, "Unknown commit.");
  return wsGit(ws, ["diff", "--name-only", "--no-color", "--no-ext-diff", from, to])
    .stdout.split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function patchBetween(ws: Workspace, from: string, to: string): string {
  const d = wsGit(ws, [
    "diff",
    "--binary",
    "--no-color",
    "--no-ext-diff",
    "--no-textconv",
    from,
    to,
  ]);
  if (!d.ok) throw new ValaError(500, `Could not produce patch: ${d.stderr.trim().slice(0, 300)}`);
  return d.stdout;
}

export function commitLog(
  ws: Workspace,
  limit = 50,
): { sha: string; at: string; subject: string }[] {
  const r = wsGit(ws, ["log", `-${limit}`, "--format=%H%x1f%cI%x1f%s"]);
  return r.stdout
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [sha, at, subject] = l.split("\u001f");
      return { sha, at, subject };
    });
}
