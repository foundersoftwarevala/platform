import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ValaError } from "./util.server.ts";

/**
 * Runs the commands Vala AI is allowed to run, and nothing else.
 *
 * A command is a plain list of tokens — no quotes, pipes, redirection or
 * variable expansion — whose program and first argument are on an allow-list.
 * It runs inside a project workspace with a scrubbed environment (no server
 * secrets), a wall-clock timeout that kills the whole process tree, and an
 * output cap. What it is not: an OS sandbox. A check such as `npm test` runs
 * the project's own code with this server's user permissions; isolation is the
 * workspace directory and the scrubbed environment.
 */

const TOKEN = /^[A-Za-z0-9_@./:=,+-]+$/;

const NPX_TOOLS = ["tsc", "vitest", "eslint", "prettier", "jest", "mocha"];

const ALLOWED: Record<string, (args: string[]) => boolean> = {
  npm: (a) =>
    a[0] === "test" ||
    a[0] === "ci" ||
    (a[0] === "run" && a.length >= 2) ||
    (a[0] === "install" && a.length === 1),
  // npx options must come before the tool name, so allowing only an exact tool
  // name (or --no-install then the tool) in first place rejects -y, --yes,
  // --package, tool@version and every other way to pick what npx fetches.
  npx: (a) =>
    NPX_TOOLS.includes(a[0] ?? "") || (a[0] === "--no-install" && NPX_TOOLS.includes(a[1] ?? "")),
  node: (a) => a[0] === "--test" || /^[A-Za-z0-9_./-]+\.(m?js|cjs)$/.test(a[0] ?? ""),
  git: (a) => ["status", "diff", "log", "rev-parse", "show"].includes(a[0] ?? ""),
};

export function parseCommand(command: string): string[] {
  const tokens = command.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) throw new ValaError(400, "Command is empty.");
  if (tokens.length > 24) throw new ValaError(400, "Command has too many arguments.");
  for (const t of tokens) {
    if (!TOKEN.test(t))
      throw new ValaError(400, `Command token "${t}" contains characters that are not allowed.`);
    if (t.includes("..")) throw new ValaError(400, "Command may not reference parent directories.");
  }
  const [program, ...args] = tokens;
  const rule = ALLOWED[program];
  if (!rule || !rule(args))
    throw new ValaError(
      400,
      `"${tokens.slice(0, 2).join(" ")}" is not an allowed command. Allowed: npm test|ci|install|run <script>, npx tsc|vitest|eslint|prettier|jest|mocha, node --test, node <file>.js, git status|diff|log|rev-parse|show.`,
    );
  // npx runs only what the project already has installed: with --no-install it
  // refuses to download a missing tool instead of fetching and executing it.
  if (program === "npx" && args[0] !== "--no-install") return ["npx", "--no-install", ...args];
  return tokens;
}

const ENV_KEEP = [
  "PATH",
  "Path",
  "PATHEXT",
  "SystemRoot",
  "SYSTEMROOT",
  "ComSpec",
  "COMSPEC",
  "TEMP",
  "TMP",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "ProgramFiles",
  "ProgramData",
  "LANG",
  "TERM",
];

function scrubbedEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ENV_KEEP) if (process.env[key] !== undefined) env[key] = process.env[key];
  env.CI = "1";
  env.NO_COLOR = "1";
  env.FORCE_COLOR = "0";
  return env;
}

export type ExecResult = {
  exitCode: number | null;
  timedOut: boolean;
  cancelled: boolean;
  durationMs: number;
  output: string;
  truncated: boolean;
};

function killTree(pid: number | undefined) {
  if (!pid) return;
  try {
    if (process.platform === "win32")
      spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-pid, "SIGKILL");
  } catch {
    /* already gone */
  }
}

/**
 * npx falls back to its own cache (~/.npm/_npx) and to the registry when the
 * project lacks a tool; --no-install stops the download but still runs a cached
 * copy. So an npx tool runs only if the project itself has it installed.
 */
function missingNpxTool(tokens: string[], cwd: string): string | null {
  if (tokens[0] !== "npx") return null;
  const tool = tokens[1] === "--no-install" ? tokens[2] : tokens[1];
  const bin = join(cwd, "node_modules", ".bin", tool);
  return existsSync(bin) || existsSync(`${bin}.cmd`) ? null : tool;
}

export function runCommand(
  tokens: string[],
  opts: { cwd: string; timeoutMs: number; maxOutputBytes: number; signal?: AbortSignal },
): Promise<ExecResult> {
  const started = Date.now();
  const missing = missingNpxTool(tokens, opts.cwd);
  if (missing)
    return Promise.resolve({
      exitCode: 127,
      timedOut: false,
      cancelled: false,
      durationMs: 0,
      truncated: false,
      output: `[vala-ai] Refused: "${missing}" is not installed in this project (node_modules/.bin/${missing}). npx is not allowed to download it or run a cached copy; add it to the project's devDependencies.\n`,
    });
  return new Promise((resolve) => {
    // shell:true is required on Windows for npm/npx (.cmd shims). Every token
    // was checked against TOKEN above, so no shell syntax can reach it.
    const child = spawn(tokens[0], tokens.slice(1), {
      cwd: opts.cwd,
      env: scrubbedEnv(),
      shell: true,
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    const chunks: Buffer[] = [];
    let size = 0;
    let truncated = false;
    let timedOut = false;
    let cancelled = false;
    const collect = (b: Buffer) => {
      chunks.push(b);
      size += b.length;
      // Keep the most recent output: failures are reported at the end.
      while (size > opts.maxOutputBytes && chunks.length > 1) {
        size -= chunks.shift()!.length;
        truncated = true;
      }
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, opts.timeoutMs);
    const onAbort = () => {
      cancelled = true;
      killTree(child.pid);
    };
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    const finish = (exitCode: number | null, extra = "") => {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      let output = Buffer.concat(chunks).toString("utf8") + extra;
      if (output.length > opts.maxOutputBytes) {
        output = output.slice(output.length - opts.maxOutputBytes);
        truncated = true;
      }
      resolve({
        exitCode,
        timedOut,
        cancelled,
        durationMs: Date.now() - started,
        output,
        truncated,
      });
    };
    child.on("error", (e) => finish(null, `\n[spawn error] ${e.message}`));
    child.on("close", (code) => finish(code));
  });
}

/** Git with fixed arguments, used by the workspace layer (never model-supplied). */
export function git(
  cwd: string,
  args: string[],
  input?: string,
): { ok: boolean; stdout: string; stderr: string; status: number | null } {
  const r = spawnSync("git", args, {
    cwd,
    input,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...scrubbedEnv(), GIT_TERMINAL_PROMPT: "0" },
  });
  return {
    ok: r.status === 0,
    stdout: r.stdout ?? "",
    stderr: (r.stderr ?? "") + (r.error ? String(r.error) : ""),
    status: r.status,
  };
}
