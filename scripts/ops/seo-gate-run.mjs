/**
 * Guarded gate runner. Every evaluation is read-only; a complete scoped plan
 * passes the loss guard before decisions/fingerprints are committed together.
 *
 * node scripts/ops/seo-gate-run.mjs --kind slot --slice 50 --dry-run
 * node scripts/ops/seo-gate-run.mjs --kind slot --slice 50 --max-drop-percent 2
 */
import { readFileSync, mkdirSync, openSync, closeSync, unlinkSync, writeSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { backupGate } from "./_seo-gate-backup.mjs";
import { deploymentSetting } from "./_seo-store.mjs";

const args = process.argv.slice(2);
const flags = new Set(["--dry-run", "--cross-only"]);
const options = new Set(["--kind", "--slice", "--max-drop-percent", "--expected-hreflang"]);
const values = new Map();
for (let at = 0; at < args.length; at++) {
  const flag = args[at];
  if (flags.has(flag)) {
    if (values.has(flag)) throw new Error(`Duplicate argument ${flag}`);
    values.set(flag, true);
  } else if (options.has(flag) && args[at + 1] && !args[at + 1].startsWith("--")) {
    if (values.has(flag)) throw new Error(`Duplicate argument ${flag}`);
    values.set(flag, args[++at]);
  } else throw new Error(`Unknown or incomplete argument ${flag}`);
}
const allKinds = ["slot", "product", "category", "country", "blog"];
const kinds = values.has("--kind") ? [values.get("--kind")] : allKinds;
if (kinds.some((kind) => !allKinds.includes(kind))) throw new Error("Unsupported gate kind");
const slice = Number(values.get("--slice") ?? 50);
const threshold = Number(
  values.get("--max-drop-percent") ?? process.env.SEO_GATE_MAX_DROP_PERCENT ?? 2,
);
if (!Number.isInteger(slice) || slice < 1 || slice > 500) throw new Error("Slice must be 1..500");
if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100)
  throw new Error("Drop threshold must be a percentage between 0 and 100");
const dryRun = values.has("--dry-run");
const crossOnly = values.has("--cross-only");
const expectedHreflang = values.has("--expected-hreflang")
  ? Number(values.get("--expected-hreflang"))
  : undefined;
if (expectedHreflang !== undefined) {
  if (!Number.isSafeInteger(expectedHreflang) || expectedHreflang < 1)
    throw new Error("Expected hreflang fallback must be a positive safe integer");
  if (crossOnly || !kinds.includes("slot"))
    throw new Error("Expected hreflang fallback requires slot evaluation");
}

function appEnv() {
  const name = process.env.SV_PM2_NAME || "softwarevala-staging";
  const pids = execFileSync("pm2", ["pid", name], { encoding: "utf8" })
    .trim()
    .split(/\s+/)
    .filter((pid) => /^[1-9]\d*$/.test(pid));
  if (pids.length !== 1) throw new Error(`Expected one running ${name} process`);
  return Object.fromEntries(
    readFileSync(`/proc/${pids[0]}/environ`, "utf8")
      .split("\0")
      .flatMap((item) => {
        const at = item.indexOf("=");
        return at > 0 ? [[item.slice(0, at), item.slice(at + 1)]] : [];
      }),
  );
}
const env = process.env.SUPABASE_URL ? process.env : appEnv();
for (const name of ["SEO_STORE", "VPS_DATABASE_URL", "DEPLOY_REPO_DIR"])
  if (env[name]) process.env[name] = env[name];
const token = env.INTERNAL_API_TOKEN?.trim();
const base = env.SUPABASE_URL?.trim();
const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!token || !base || !key) throw new Error("Application gate/catalogue credentials are missing");
const origin = `http://127.0.0.1:${env.PORT || "3000"}`;
const root = resolve(process.env.SEO_GATE_BACKUP_ROOT || "/root/sv-seo-backup");
mkdirSync(root, { recursive: true, mode: 0o700 });
const lockPath = resolve(root, ".gate-run.lock");
const lock = openSync(lockPath, "wx", 0o600);
writeSync(lock, `${process.pid}\n${new Date().toISOString()}\n`);
let locked = true;
process.on("exit", () => {
  if (locked) {
    closeSync(lock);
    unlinkSync(lockPath);
  }
});

async function api(phase, body, extra = "") {
  const response = await fetch(`${origin}/api/internal/seo-gate?phase=${phase}${extra}`, {
    method: body ? "POST" : "GET",
    headers: { "x-internal-token": token, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok && !(response.status === 409 && data.stopped))
    throw new Error(
      `Gate ${phase} failed (HTTP ${response.status}): ${data.error || "invalid response"}`,
    );
  if (data.protocol !== 2)
    throw new Error("Guarded gate protocol is not deployed; refusing legacy saves");
  return data;
}
async function record(table, row) {
  const response = await fetch(`${base}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!response.ok)
    throw new Error(`Gate saved, but ${table} audit failed (HTTP ${response.status})`);
}

try {
  const before = await api("preflight");
  if (!before.dryRun || !before.atomicCommit)
    throw new Error("Gate safety capabilities unavailable");
  if (before.detailedReport !== true)
    throw new Error("Detailed gate report capability is not deployed");
  if (expectedHreflang !== undefined && before.hreflangFallback !== true)
    throw new Error("Expected hreflang fallback capability is not deployed");
  if (deploymentSetting("SEO_STORE") !== "vps")
    throw new Error("Guarded runner requires SEO_STORE=vps");
  const backup = backupGate(deploymentSetting("VPS_DATABASE_URL"), root, before.database);
  console.log(`backup verified: ${backup.directory} sha256=${backup.checksum}`);
  const checked = await api("preflight");
  if (checked.signature !== before.signature)
    throw new Error("Store changed while backing up; rerun");
  const input = {
    kinds,
    expectedSignature: before.signature,
    maxDropPercent: threshold,
    crossOnly,
    decisions: [],
    fingerprints: [],
  };
  const warnings = new Set();
  let hreflangFallbackPages = 0;
  if (!crossOnly)
    for (const kind of kinds) {
      let total = 0;
      for (let offset = 0; ; offset += slice) {
        let payload;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            payload = await api(
              "evaluate",
              {},
              `&kind=${kind}&offset=${offset}&limit=${slice}&dry_run=1` +
                (kind === "slot" && expectedHreflang !== undefined
                  ? `&expected_hreflang=${expectedHreflang}`
                  : ""),
            );
            break;
          } catch (error) {
            console.error(`${kind} offset ${offset} attempt ${attempt}: ${error.message}`);
            if (attempt === 3) throw error;
            await new Promise((done) => setTimeout(done, attempt * 5000));
          }
        }
        if (!payload.dryRun || !Array.isArray(payload.rows) || !Array.isArray(payload.fingerprints))
          throw new Error("Evaluation-only response is incomplete");
        if (payload.evaluated !== payload.rows.length)
          throw new Error("Evaluation row count mismatch");
        if (
          !Array.isArray(payload.warnings) ||
          payload.warnings.some((warning) => typeof warning !== "string") ||
          !Number.isInteger(payload.hreflangFallbackPages) ||
          payload.hreflangFallbackPages < 0 ||
          payload.hreflangFallbackPages > payload.evaluated
        )
          throw new Error("Evaluation warning/fallback report is incomplete");
        for (const warning of payload.warnings) {
          if (!warnings.has(warning)) console.warn(`WARNING: ${warning}`);
          warnings.add(warning);
        }
        hreflangFallbackPages += payload.hreflangFallbackPages;
        input.decisions.push(...payload.rows);
        input.fingerprints.push(...payload.fingerprints);
        total += payload.rows.length;
        console.log(`${kind}: ${total} evaluated (no saves)`);
        if (payload.done) break;
        if (!payload.evaluated)
          throw new Error("Incomplete inventory slice; refusing partial plan");
      }
    }
  const plan = await api("plan", input);
  const report = { ...plan, hreflangFallbackPages, warnings: [...warnings] };
  console.log(`PROJECTED ${JSON.stringify(report)}`);
  if (plan.stopped) {
    console.error(
      `STOP: ${plan.lossPercent.toFixed(3)}% of existing eligible pages lost; threshold >${threshold}%. NO SAVES.`,
    );
    process.exitCode = 2;
  } else if (dryRun) {
    console.log("DRY RUN: no decisions, fingerprints or manager audit records saved.");
  } else {
    const committed = await api("commit", input);
    console.log(`COMMIT ${JSON.stringify(committed)}`);
    if (committed.stopped || !committed.saved)
      throw new Error("Commit refused; no gate rows saved");
    const after = await api("preflight");
    const eligible = after.decisions.filter((row) => row.sitemap_eligible).length;
    const now = new Date().toISOString();
    const byState = {};
    for (const row of after.decisions) byState[row.state] = (byState[row.state] || 0) + 1;
    await record("seo_audits", {
      name: `SEO safety gate - ${eligible} of ${after.decisions.length} pages eligible`,
      status: "completed",
      started_at: now,
      completed_at: now,
      pages_crawled: after.decisions.length,
      issues_found: after.decisions.length - eligible,
      score: after.decisions.length ? Math.round((eligible / after.decisions.length) * 100) : 0,
      breakdown: {
        audit_version: "v2",
        by_state: byState,
        ...committed,
        hreflangFallbackPages,
        warnings: [...warnings],
        backup: backup.directory,
      },
    });
    for (const [name, category, status, affected] of [
      ["Indexing gate coverage", "indexing", "pass", after.decisions.length],
      ["Sitemap eligibility", "indexing", "pass", eligible],
      [
        "Exact duplicate content",
        "content",
        plan.exactDuplicateGroups ? "fail" : "pass",
        plan.exactDuplicateGroups,
      ],
      [
        "Country-name-only duplication",
        "content",
        plan.maskedDuplicateGroups ? "fail" : "pass",
        plan.maskedDuplicateGroups,
      ],
      ["Pages held back", "indexing", "warning", after.decisions.length - eligible],
    ])
      await record("seo_technical_checks", {
        name,
        category,
        status,
        detail: `Guarded gate v2: ${JSON.stringify(committed)}`,
        affected_urls: affected,
        last_checked_at: now,
      });
    console.log(`SAVED: ${eligible} globally eligible; manager audit recorded.`);
  }
} catch (error) {
  console.error(`GATE FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  closeSync(lock);
  unlinkSync(lockPath);
  locked = false;
}
