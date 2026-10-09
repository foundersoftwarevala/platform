import { mkdirSync, statfsSync } from "node:fs";
import { cpus, freemem, loadavg, totalmem } from "node:os";
import { audit } from "./audit.server.ts";
import { dataDir, DEFAULT_SETTINGS, type Settings } from "./config.server.ts";
import { all, run } from "./db.server.ts";
import { now, parseJson, ValaError } from "./util.server.ts";

const NUMERIC_BOUNDS: Partial<Record<keyof Settings, [number, number]>> = {
  model_timeout_s: [10, 3600],
  model_max_tokens: [64, 8192],
  command_timeout_s: [10, 7200],
  max_output_kb: [16, 4096],
  max_fix_loops: [0, 10],
  max_task_write_kb: [16, 102400],
  max_file_kb: [4, 1024],
  min_free_disk_gb: [1, 1000],
  min_free_mem_mb: [256, 65536],
  chat_per_minute: [1, 600],
  tasks_per_minute: [1, 600],
};

export function getSettings(): Settings {
  const out = { ...DEFAULT_SETTINGS } as Settings;
  for (const row of all<{ key: string; value_json: string }>(
    "select key, value_json from settings",
  )) {
    if (row.key in out)
      (out as Record<string, unknown>)[row.key] = parseJson(
        row.value_json,
        (out as Record<string, unknown>)[row.key],
      );
  }
  return out;
}

export function updateSettings(patch: Record<string, unknown>, actor: string): Settings {
  const changed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) throw new ValaError(400, `Unknown setting: ${key}`);
    if (key === "model_url") {
      let url: URL;
      try {
        url = new URL(String(value));
      } catch {
        throw new ValaError(400, "Model URL is not a valid URL.");
      }
      // The agent must run on owned infrastructure: loopback or private network only.
      const host = url.hostname;
      const privateHost =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host);
      if (!privateHost || !/^https?:$/.test(url.protocol))
        throw new ValaError(
          400,
          "Model URL must point at a self-hosted server on this machine or a private network.",
        );
      changed[key] = url.toString().replace(/\/+$/, "");
    } else {
      const n = Number(value);
      const [min, max] = NUMERIC_BOUNDS[key as keyof Settings] ?? [0, Number.MAX_SAFE_INTEGER];
      if (!Number.isFinite(n) || n < min || n > max)
        throw new ValaError(400, `${key} must be between ${min} and ${max}.`);
      changed[key] = Math.round(n);
    }
  }
  for (const [key, value] of Object.entries(changed)) {
    run(
      "insert into settings (key, value_json, updated_at, updated_by) values (?,?,?,?) on conflict(key) do update set value_json = excluded.value_json, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
      key,
      JSON.stringify(value),
      now(),
      actor,
    );
  }
  audit(actor, "settings.update", "settings", null, changed);
  return getSettings();
}

export type ResourceSnapshot = {
  freeDiskGb: number;
  totalDiskGb: number;
  freeMemMb: number;
  totalMemMb: number;
  cpuCount: number;
  load1: number | null;
  ok: boolean;
  problems: string[];
};

/** Measured, not assumed: what the data volume and the machine have right now. */
export function resources(settings: Settings = getSettings()): ResourceSnapshot {
  mkdirSync(dataDir(), { recursive: true });
  const fs = statfsSync(dataDir());
  const freeDiskGb = (fs.bavail * fs.bsize) / 1024 ** 3;
  const totalDiskGb = (fs.blocks * fs.bsize) / 1024 ** 3;
  const freeMemMb = freemem() / 1024 ** 2;
  const problems: string[] = [];
  if (freeDiskGb < settings.min_free_disk_gb)
    problems.push(
      `Free disk ${freeDiskGb.toFixed(1)} GB is below the ${settings.min_free_disk_gb} GB floor.`,
    );
  if (freeMemMb < settings.min_free_mem_mb)
    problems.push(
      `Free memory ${Math.round(freeMemMb)} MB is below the ${settings.min_free_mem_mb} MB floor.`,
    );
  return {
    freeDiskGb: Number(freeDiskGb.toFixed(2)),
    totalDiskGb: Number(totalDiskGb.toFixed(2)),
    freeMemMb: Math.round(freeMemMb),
    totalMemMb: Math.round(totalmem() / 1024 ** 2),
    cpuCount: cpus().length,
    load1: process.platform === "win32" ? null : Number(loadavg()[0].toFixed(2)),
    ok: problems.length === 0,
    problems,
  };
}
