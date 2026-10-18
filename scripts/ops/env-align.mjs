/**
 * The environment file on disk, against the one the application is actually
 * running with.
 *
 * These drifted apart and nobody could see it. rebuild-with-env.sh reads the
 * running process's environment and says why in its own header — "the
 * application's own environment is the authoritative copy" — so a deploy
 * carries the right values forward whatever the file says. The file was left
 * behind, and four scheduled jobs read the file:
 *
 *   sv-sweeps.sh        every 5 minutes   SLA, promise and AMS sweeps
 *   sv-telemetry.sh     every 5 minutes   telemetry
 *   sv-demo-monitor.sh  every 15 minutes  demo health
 *   sv-seo-crawl.sh     daily             the SEO crawl
 *
 * So those four were writing runtime data to the old hosted backend while the
 * application wrote to the VPS, and both looked healthy. The demo monitor is
 * how it surfaced: it reported a successful check every fifteen minutes while
 * the VPS database's last monitor row stayed at 25 September.
 *
 * This compares the two and, with --apply, makes the file match the process.
 * It never prints a secret: a value is reported as same, different or missing,
 * by name only.
 *
 *   node scripts/ops/env-align.mjs             what differs
 *   node scripts/ops/env-align.mjs --apply     make the file match
 *
 * Run it on the server. The authoritative side is the running process, never
 * this file, so it can only ever copy in that direction.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
// Appending is a separate decision from correcting. The running process also
// carries the shell and PM2 variables of whatever started it - SSH_CLIENT,
// LS_COLORS, NODE_CHANNEL_FD, pm_uptime - and writing those into a file that
// scheduled jobs source would be worse than the drift being fixed. So --apply
// corrects the values that disagree, and nothing is added unless asked.
const APPEND = process.argv.includes("--append");
const ENV_FILE =
  process.argv.find((a) => a.startsWith("--file="))?.slice(7) ?? "/var/www/softwarevala/.env";
const PROCESS_MATCH =
  process.argv.find((a) => a.startsWith("--process="))?.slice(10) ?? "node /var/www/s";

/** Values that belong to one process and must never be copied into a file. */
const NEVER_COPY = new Set([
  "PWD",
  "OLDPWD",
  "SHLVL",
  "_",
  "HOME",
  "PATH",
  "TERM",
  "USER",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "HOSTNAME",
  "TMPDIR",
  "NODE_ENV",
  "PM2_HOME",
  "PM2_USAGE",
  "PM2_JSON_PROCESSING",
  "PM2_CLI",
  "pm_id",
  "name",
  "unique_id",
  "exec_interpreter",
  "exec_mode",
  "instance_var",
  "node_args",
  "pm_exec_path",
  "pm_cwd",
  "pm_out_log_path",
  "pm_err_log_path",
  "pm_pid_path",
  "km_link",
  "vizion",
  "autorestart",
  "watch",
  "instances",
  "restart_time",
  "created_at",
  "status",
  "version",
  "node_version",
  "merge_logs",
  "windowsHide",
  "kill_retry_time",
  "treekill",
  "automation",
  "pmx",
  "autostart",
  "vizion_running",
  "prev_restart_delay",
  // Whatever shell or PM2 started the process, not the application config.
  "DBUS_SESSION_BUS_ADDRESS",
  "LESSCLOSE",
  "LESSOPEN",
  "LS_COLORS",
  "NODE_APP_INSTANCE",
  "NODE_CHANNEL_FD",
  "NODE_CHANNEL_SERIALIZATION_MODE",
  "SSH_CLIENT",
  "SSH_CONNECTION",
  "SSH_TTY",
  "XDG_RUNTIME_DIR",
  "XDG_SESSION_CLASS",
  "XDG_SESSION_ID",
  "XDG_SESSION_TYPE",
  "exit_code",
  "namespace",
  "pm_uptime",
  "unstable_restarts",
  "username",
]);

function readProcessEnv() {
  const pid = execFileSync("pgrep", ["-f", PROCESS_MATCH], { encoding: "utf8" })
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)[0];
  if (!pid) throw new Error(`No running process matches "${PROCESS_MATCH}".`);
  const raw = readFileSync(`/proc/${pid}/environ`, "utf8");
  const out = new Map();
  for (const entry of raw.split("\0")) {
    const eq = entry.indexOf("=");
    if (eq <= 0) continue;
    out.set(entry.slice(0, eq), entry.slice(eq + 1));
  }
  return { pid, env: out };
}

function readFileEnv(path) {
  const out = new Map();
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!m) continue;
    out.set(m[1], m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2"));
  }
  return out;
}

/** Enough to recognise a value without revealing it. */
function shape(value) {
  if (value === undefined) return "(absent)";
  if (value === "") return "(empty)";
  if (/^https?:\/\//.test(value)) return value.replace(/^(https?:\/\/[^/]+).*/, "$1");
  if (/^eyJ[A-Za-z0-9_-]+\./.test(value)) return `JWT, ${value.length} chars`;
  if (/^(sb_|sbp_)/.test(value)) return `opaque key, ${value.length} chars`;
  if (value.length > 24) return `${value.length} chars`;
  return value;
}

const { pid, env: live } = readProcessEnv();
const onDisk = readFileEnv(ENV_FILE);

console.log(`process : pid ${pid}, ${live.size} variables`);
console.log(`file    : ${ENV_FILE}, ${onDisk.size} variables\n`);

const differs = [];
const missing = [];
for (const [key, value] of live) {
  if (NEVER_COPY.has(key)) continue;
  if (!onDisk.has(key)) {
    missing.push(key);
  } else if (onDisk.get(key) !== value) {
    differs.push(key);
  }
}

if (differs.length === 0 && missing.length === 0) {
  console.log("The file already matches the running application.");
  process.exit(0);
}

if (differs.length) {
  console.log("DIFFERENT — the file disagrees with the running application:");
  for (const key of differs.sort()) {
    console.log(`  ${key}`);
    console.log(`    file    ${shape(onDisk.get(key))}`);
    console.log(`    process ${shape(live.get(key))}`);
  }
  console.log("");
}

if (missing.length) {
  console.log(`ONLY IN THE PROCESS — ${missing.length} variable(s) the file does not carry:`);
  console.log(`  ${missing.sort().join(", ")}\n`);
}

if (!APPLY) {
  console.log("Nothing was changed. Re-run with --apply to correct the values that differ,");
  console.log("and add --append to also copy the variables the file does not carry.");
  process.exit(differs.length ? 1 : 0);
}

// Keep the old file. It is the only record of what the scheduled jobs were
// reading, and it holds credentials that are still valid somewhere else.
const backup = `${ENV_FILE}.before-align-${new Date().toISOString().replace(/[:.]/g, "-")}`;
copyFileSync(ENV_FILE, backup);

// Rewrite in place, preserving order, comments and every key the file already
// had; only the values that differ are replaced, and anything the process
// carries that the file lacks is appended with a note saying where it came
// from.
const lines = readFileSync(ENV_FILE, "utf8").split("\n");
const replaced = new Set();
const updated = lines.map((line) => {
  const m = line.match(/^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=)(.*)$/);
  if (!m) return line;
  const key = m[2];
  if (!live.has(key) || NEVER_COPY.has(key)) return line;
  const value = live.get(key);
  if (onDisk.get(key) === value) return line;
  replaced.add(key);
  return `${m[1]}${key}${m[3]}${value}`;
});

const appended = APPEND ? missing.filter((k) => !NEVER_COPY.has(k)) : [];
if (appended.length) {
  updated.push("");
  updated.push(`# Copied from the running application on ${new Date().toISOString()}`);
  updated.push("# by scripts/ops/env-align.mjs, because the scheduled jobs read this");
  updated.push("# file and the application reads its own process environment.");
  for (const key of appended.sort()) updated.push(`${key}=${live.get(key)}`);
}

writeFileSync(ENV_FILE, updated.join("\n"));
console.log(`Backed up to ${backup}`);
console.log(`Updated ${replaced.size} value(s), appended ${appended.length}.`);
console.log("The scheduled jobs that read this file now agree with the application.");
