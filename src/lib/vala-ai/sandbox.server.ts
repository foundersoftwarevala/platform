import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ValaError } from "./util.server.ts";

/**
 * Where acceptance checks run (docs/vala-ai/SANDBOX_DESIGN.md).
 *
 *   VALA_AI_SANDBOX = off     checks run on this machine as the server user
 *                             (development only; evidence says "none")
 *                   = docker  every check runs in a disposable container; if
 *                             Docker or a pinned image is missing the check
 *                             is refused, never quietly run on the host.
 * Default: docker when NODE_ENV=production, off otherwise.
 *
 * The container sees only the project's workspace (its .git read-only), has
 * no network, no capabilities, a read-only root filesystem, a non-root user,
 * and pid, memory and CPU limits. Nothing from the host environment is passed.
 */

export type SandboxPolicy = {
  mode: "off" | "docker";
  image: string | null;
  user: string;
  memoryMb: number;
  cpus: number;
  pids: number;
  tmpfsMb: number;
  dockerBin: string;
};

const DIGEST_PINNED = /^[a-z0-9][a-z0-9._/-]*(:[A-Za-z0-9._-]+)?@sha256:[0-9a-f]{64}$/;

function num(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new ValaError(500, `${name} must be between ${min} and ${max}.`);
  return n;
}

export function sandboxPolicy(env: NodeJS.ProcessEnv = process.env): SandboxPolicy {
  const raw = env.VALA_AI_SANDBOX?.trim() || (env.NODE_ENV === "production" ? "docker" : "off");
  if (raw !== "off" && raw !== "docker")
    throw new ValaError(500, `VALA_AI_SANDBOX must be "off" or "docker", not "${raw}".`);
  if (
    raw === "off" &&
    env.NODE_ENV === "production" &&
    env.VALA_AI_SANDBOX_ALLOW_OFF_IN_PRODUCTION !== "yes"
  )
    throw new ValaError(500, "VALA_AI_SANDBOX=off is not allowed in production.");
  const user = env.VALA_AI_SANDBOX_USER?.trim() || "10001:10001";
  if (!/^[1-9]\d{0,6}:[1-9]\d{0,6}$/.test(user))
    throw new ValaError(500, "VALA_AI_SANDBOX_USER must be uid:gid, not root.");
  return {
    mode: raw,
    image: env.VALA_AI_SANDBOX_IMAGE?.trim() || null,
    user,
    memoryMb: num(env.VALA_AI_SANDBOX_MEMORY_MB, 1024, 128, 16384, "VALA_AI_SANDBOX_MEMORY_MB"),
    cpus: num(env.VALA_AI_SANDBOX_CPUS, 1, 0.1, 16, "VALA_AI_SANDBOX_CPUS"),
    pids: num(env.VALA_AI_SANDBOX_PIDS, 256, 16, 4096, "VALA_AI_SANDBOX_PIDS"),
    tmpfsMb: num(env.VALA_AI_SANDBOX_TMPFS_MB, 256, 16, 4096, "VALA_AI_SANDBOX_TMPFS_MB"),
    dockerBin: env.VALA_AI_DOCKER_BIN?.trim() || "docker",
  };
}

/** Why a docker-mode check cannot run, or null when it can. Checked live, cached briefly. */
let cache: { at: number; key: string; problem: string | null } | null = null;
export function dockerProblem(policy: SandboxPolicy): string | null {
  if (!policy.image) return "VALA_AI_SANDBOX_IMAGE is not set.";
  if (!DIGEST_PINNED.test(policy.image))
    return "VALA_AI_SANDBOX_IMAGE must be pinned by digest (name@sha256:…).";
  const key = `${policy.dockerBin}|${policy.image}`;
  if (cache && cache.key === key && Date.now() - cache.at < 60_000) return cache.problem;
  const v = spawnSync(policy.dockerBin, ["version", "--format", "{{.Server.Version}}"], {
    encoding: "utf8",
    timeout: 8000,
    windowsHide: true,
  });
  let problem: string | null = null;
  if (v.error || v.status !== 0)
    problem = `Docker is not available: ${(v.error?.message ?? v.stderr ?? "").trim().slice(0, 200) || `exit ${v.status}`}`;
  else {
    const img = spawnSync(
      policy.dockerBin,
      ["image", "inspect", "--format", "{{.Id}}", policy.image],
      { encoding: "utf8", timeout: 8000, windowsHide: true },
    );
    if (img.status !== 0)
      problem = `The sandbox image ${policy.image} is not present on this host (pull it deliberately; checks never pull).`;
  }
  cache = { at: Date.now(), key, problem };
  return problem;
}

export function containerName(evidenceId: string): string {
  return `vala-ai-${evidenceId.toLowerCase().replace(/[^a-z0-9-]/g, "")}`;
}

/** The full `docker run` argument list for one check. Tokens become the container's command, never a shell string. */
export function dockerRunArgs(
  tokens: string[],
  workspacePath: string,
  policy: SandboxPolicy,
  name: string,
): string[] {
  if (!policy.image) throw new ValaError(500, "No sandbox image configured.");
  return [
    "run",
    "--rm",
    "--name",
    name,
    "--label",
    "vala-ai=1",
    "--init",
    "--network",
    "none",
    "--read-only",
    "--user",
    policy.user,
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    String(policy.pids),
    "--memory",
    `${policy.memoryMb}m`,
    "--memory-swap",
    `${policy.memoryMb}m`,
    "--cpus",
    String(policy.cpus),
    "--tmpfs",
    `/tmp:rw,size=${policy.tmpfsMb}m,noexec,nosuid,nodev`,
    "--mount",
    `type=bind,source=${workspacePath},target=/work`,
    "--mount",
    `type=bind,source=${join(workspacePath, ".git")},target=/work/.git,readonly`,
    "--workdir",
    "/work",
    "--env",
    "CI=1",
    "--env",
    "NO_COLOR=1",
    "--env",
    "HOME=/tmp",
    "--env",
    "npm_config_cache=/tmp/.npm",
    "--env",
    "npm_config_update_notifier=false",
    policy.image,
    ...tokens,
  ];
}

/** Removes containers left behind by a crashed server (label vala-ai=1, older than maxAgeMs). */
export function sweepStaleContainers(policy: SandboxPolicy, maxAgeMs: number): string[] {
  const ps = spawnSync(
    policy.dockerBin,
    ["ps", "-a", "--filter", "label=vala-ai=1", "--format", "{{.ID}}\t{{.CreatedAt}}"],
    { encoding: "utf8", timeout: 8000, windowsHide: true },
  );
  if (ps.status !== 0) return [];
  const removed: string[] = [];
  for (const line of ps.stdout.split("\n").filter(Boolean)) {
    const [id, created] = line.split("\t");
    const at = Date.parse(created.replace(/ [A-Z]{2,5}$/, ""));
    if (Number.isFinite(at) && Date.now() - at > maxAgeMs) {
      spawnSync(policy.dockerBin, ["rm", "-f", id], { timeout: 15000, windowsHide: true });
      removed.push(id);
    }
  }
  return removed;
}
