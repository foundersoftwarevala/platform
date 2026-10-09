import { resolve } from "node:path";

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
} as const;

export type Settings = {
  -readonly [K in keyof typeof DEFAULT_SETTINGS]: (typeof DEFAULT_SETTINGS)[K] extends number
    ? number
    : string;
};
