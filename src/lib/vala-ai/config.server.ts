import { isAbsolute, relative, resolve } from "node:path";

/**
 * Where Vala AI keeps its state, and the limits it enforces.
 *
 * Everything lives under one data directory (`VALA_AI_DATA_DIR`, default
 * `<cwd>/.vala-ai`): the SQLite database, the isolated project workspaces,
 * command output kept as evidence, and release patches. Nothing in it is part
 * of the platform's source tree, and no file outside it is ever written.
 *
 * This module imports only Node built-ins and relative `.ts` files, so the
 * scripts in `scripts/vala-ai/` and the tests can load it without a bundler.
 */

export function dataDir(): string {
  return resolve(process.env.VALA_AI_DATA_DIR?.trim() || ".vala-ai");
}

/**
 * In production the data directory must be named explicitly and live outside
 * the application directory, where a deploy could delete it or ship it.
 * Returns the problem, or null when the configuration is acceptable.
 */
export function productionDataDirProblem(
  env: NodeJS.ProcessEnv = process.env,
  appDir = process.cwd(),
): string | null {
  if (env.NODE_ENV !== "production") return null;
  const configured = env.VALA_AI_DATA_DIR?.trim();
  if (!configured)
    return "VALA_AI_DATA_DIR is not set. In production, set it to a directory outside the application, such as /var/lib/vala-ai.";
  const r = relative(resolve(appDir), resolve(configured));
  if (r === "" || (!r.startsWith("..") && !isAbsolute(r)))
    return `VALA_AI_DATA_DIR (${configured}) is inside the application directory. Use a directory outside it, such as /var/lib/vala-ai.`;
  return null;
}

export const paths = {
  db: () => resolve(dataDir(), "vala.db"),
  workspaces: () => resolve(dataDir(), "workspaces"),
  evidence: () => resolve(dataDir(), "evidence"),
  releases: () => resolve(dataDir(), "releases"),
};

/** Defaults for the limits an owner can change in Settings. */
export const DEFAULT_SETTINGS = {
  model_url: process.env.VALA_AI_MODEL_URL?.trim() || "http://127.0.0.1:5200",
  model_timeout_s: 600,
  model_max_tokens: 2048,
  command_timeout_s: 600,
  max_output_kb: 256,
  max_fix_loops: 3,
  max_task_write_kb: 2048,
  max_file_kb: 48,
  min_free_disk_gb: 3,
  min_free_mem_mb: 1024,
  chat_per_minute: 6,
  tasks_per_minute: 10,
  /** "local" (llama.cpp at model_url) or "ai-api-manager" (the platform gateway). */
  model_source: "local",
  /** AI API Manager service id; empty lets the gateway pick an active chat service. */
  gateway_service: "",
} as const;

export type Settings = {
  -readonly [K in keyof typeof DEFAULT_SETTINGS]: (typeof DEFAULT_SETTINGS)[K] extends number
    ? number
    : string;
};
