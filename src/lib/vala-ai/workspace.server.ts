import {
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { audit } from "./audit.server.ts";
import { dataDir, paths } from "./config.server.ts";
import { one, run } from "./db.server.ts";
import { git } from "./exec.server.ts";
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
  run(
    "update workspaces set status = 'ready', base_commit = ?, error = null where id = ?",
    head.stdout.trim(),
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
  const tracked = git(ws.path, ["ls-files", "-z"]);
  const untracked = git(ws.path, ["ls-files", "-z", "--others", "--exclude-standard"]);
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
  const buf = readFileSync(abs);
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
  const beforeSha = existsSync(abs) ? sha256(readFileSync(abs)) : null;
  mkdirSync(dirname(abs), { recursive: true });
  // Where the platform supports it, refuse to follow a link that appears at the
  // final path between the check above and this write.
  const flags =
    constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | (constants.O_NOFOLLOW ?? 0);
  const fd = openSync(abs, flags, 0o644);
  try {
    writeSync(fd, content, null, "utf8");
  } finally {
    closeSync(fd);
  }
  return { path: rel, beforeSha, afterSha: sha256(content), bytes };
}

export function deleteWorkspaceFile(
  ws: Workspace,
  rel: string,
): { path: string; beforeSha: string } {
  const abs = resolveInside(ws, rel);
  if (!existsSync(abs)) throw new ValaError(404, `File "${rel}" not found.`);
  const beforeSha = sha256(readFileSync(abs));
  rmSync(abs);
  return { path: rel, beforeSha };
}

export function headCommit(ws: Workspace): string {
  const r = git(ws.path, ["rev-parse", "HEAD"]);
  if (!r.ok) throw new ValaError(500, "Workspace HEAD unreadable.");
  return r.stdout.trim();
}

export function isClean(ws: Workspace): boolean {
  return git(ws.path, ["status", "--porcelain"]).stdout.trim() === "";
}

export function changedFiles(ws: Workspace): { status: string; path: string }[] {
  return git(ws.path, ["status", "--porcelain"])
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
  git(ws.path, ["add", "-A"]);
  const commit = git(ws.path, [...GIT_IDENTITY, "commit", "--quiet", "--allow-empty", "-m", label]);
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
  return /^[0-9a-f]{7,64}$/.test(sha) && git(ws.path, ["cat-file", "-e", `${sha}^{commit}`]).ok;
}

/** Destructive inside the workspace only; callers gate it behind an approval. */
export function resetWorkspace(ws: Workspace, sha: string) {
  if (!commitExists(ws, sha)) throw new ValaError(400, "Unknown commit.");
  const reset = git(ws.path, ["reset", "--hard", "--quiet", sha]);
  const clean = git(ws.path, ["clean", "-fd", "--quiet"]);
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
  const d = git(ws.path, ["diff", "--no-color", from, to]);
  const stat = git(ws.path, ["diff", "--stat", "--no-color", from, to]).stdout;
  return { diff: d.stdout.slice(0, maxBytes), truncated: d.stdout.length > maxBytes, stat };
}

export function changedPathsBetween(ws: Workspace, from: string, to: string): string[] {
  if (!commitExists(ws, from) || !commitExists(ws, to)) throw new ValaError(400, "Unknown commit.");
  return git(ws.path, ["diff", "--name-only", "--no-color", from, to])
    .stdout.split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function patchBetween(ws: Workspace, from: string, to: string): string {
  const d = git(ws.path, ["diff", "--binary", "--no-color", from, to]);
  if (!d.ok) throw new ValaError(500, `Could not produce patch: ${d.stderr.trim().slice(0, 300)}`);
  return d.stdout;
}

export function commitLog(
  ws: Workspace,
  limit = 50,
): { sha: string; at: string; subject: string }[] {
  const r = git(ws.path, ["log", `-${limit}`, "--format=%H%x1f%cI%x1f%s"]);
  return r.stdout
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [sha, at, subject] = l.split("\u001f");
      return { sha, at, subject };
    });
}
