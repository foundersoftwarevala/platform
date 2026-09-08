import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { resolveAction } from "@/lib/marketplace/permission-guard";
import { loadMatrix, recordDenial, rolesOf } from "@/lib/marketplace/permission-store.server";

/**
 * Deployment Center, over the deployment that actually happens.
 *
 * The brief asks for Vercel, Netlify, Railway and Cloudflare, and for GitHub and
 * GitLab OAuth. None of those have a credential in this environment, so none of
 * them can connect, and the rule at the top of the brief - no mock deployments,
 * no fake build logs, no fake live URLs, no fake connection status - decides
 * what this file does about that: it names each missing credential and connects
 * nothing.
 *
 * What it does connect is the deployment that is real. This application ships
 * by git pull, npm run build and pm2 restart onto one VPS, and every part of
 * that is readable: the repository, branch and commit come from the git working
 * tree on the host, the running instance and its health come from
 * server_instances - which the telemetry cron updates every five minutes - and
 * the live URL is checked by actually requesting it.
 *
 * So the Overview, Repositories, Environment, Domains and Demo URL tabs are
 * real, and the provider cards are honest about being unconnectable. That is a
 * more useful Deployment Center than eight cards that all say "Not connected"
 * with no reason.
 *
 * Git is read with execFile and a fixed argument list - never a shell, never
 * anything from the request - and only ever with commands that read.
 */

const run = promisify(execFile);

function url(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rows<T = Record<string, unknown>>(path: string): Promise<T[]> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, { headers: admin() });
    if (!response.ok) return [];
    return (await response.json()) as T[];
  } catch {
    return [];
  }
}

const REPO_DIR = process.env.DEPLOY_REPO_DIR?.trim() || process.cwd();

/** Read-only git, fixed arguments, no shell. */
async function git(args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run("git", ["-C", REPO_DIR, ...args], { timeout: 8000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * The repository, from the working tree rather than from a provider API.
 *
 * Section 15 says never to use a hardcoded branch list. These are the real
 * branches and the real commits; no GitHub token is needed to read them,
 * because the checkout is right here.
 */
async function repository() {
  const [remote, branch, head, branchList, log, status] = await Promise.all([
    git(["remote", "get-url", "origin"]),
    git(["rev-parse", "--abbrev-ref", "HEAD"]),
    git(["log", "-1", "--pretty=%H%n%an%n%aI%n%s"]),
    git(["branch", "-a", "--format=%(refname:short)|%(objectname:short)|%(committerdate:iso8601)"]),
    git(["log", "-12", "--pretty=%h|%an|%aI|%s"]),
    git(["status", "--porcelain"]),
  ]);

  const [sha, author, at, subject] = (head ?? "").split("\n");
  const provider = remote?.includes("github.com") ? "GitHub"
    : remote?.includes("gitlab.com") ? "GitLab" : remote ? "Other" : null;

  // The remote may carry a credential in its URL on some hosts. Strip anything
  // before the @ so it can never be shown.
  const safeRemote = remote ? remote.replace(/\/\/[^@/]*@/, "//") : null;

  return {
    connected: Boolean(remote),
    provider,
    remote: safeRemote,
    owner: safeRemote?.match(/[:/]([^/]+)\/[^/]+?(\.git)?$/)?.[1] ?? null,
    name: safeRemote?.match(/\/([^/]+?)(\.git)?$/)?.[1] ?? null,
    current_branch: branch ?? null,
    head: sha ? { sha, short: sha.slice(0, 7), author, at, subject } : null,
    branches: (branchList ?? "")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, commit, date] = line.split("|");
        return { name, commit, committed_at: date };
      }),
    recent_commits: (log ?? "")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [short, author2, at2, subject2] = line.split("|");
        return { short, author: author2, at: at2, subject: subject2 };
      }),
    working_tree_clean: status === "",
    uncommitted_files: status ? status.split("\n").filter(Boolean).length : 0,
  };
}

/**
 * Provider credentials, resolved by name.
 *
 * Never the value. The Cloudflare entry carries a real finding: the variable is
 * set, but it is 32 characters, which is the shape of a Global API Key rather
 * than the 40-character API token a Bearer header needs. Cloudflare answers
 * 6111, "Invalid format for Authorization header", and there is no
 * CLOUDFLARE_EMAIL to use the key the other way.
 */
function providerCredentials() {
  const check = (name: string, envs: string[], kind: "git" | "target") => {
    const present = envs.filter((e) => Boolean(process.env[e]?.trim()));
    return {
      name, kind,
      variables: envs,
      present,
      missing: envs.filter((e) => !process.env[e]?.trim()),
      connectable: present.length === envs.length,
    };
  };

  const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN?.trim() ?? "";
  const cloudflare = check("Cloudflare", ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"], "target");
  const cloudflareNote =
    cloudflareToken && cloudflareToken.length !== 40
      ? `CLOUDFLARE_API_TOKEN is set but is ${cloudflareToken.length} characters. A Cloudflare API token is 40; a 32-character value is a Global API Key, which authenticates with X-Auth-Email and X-Auth-Key rather than a Bearer header. Cloudflare answers 6111, "Invalid format for Authorization header", and no CLOUDFLARE_EMAIL is set to use it the other way.`
      : null;

  return [
    { ...check("GitHub", ["GITHUB_TOKEN"], "git"), note: "The host has a stored git credential, which is how pushes work, but no API token — so the repository is readable from the checkout and not through the GitHub API." },
    { ...check("GitLab", ["GITLAB_TOKEN"], "git"), note: null },
    { ...check("Vercel", ["VERCEL_TOKEN"], "target"), note: null },
    { ...check("Netlify", ["NETLIFY_TOKEN"], "target"), note: null },
    { ...check("Railway", ["RAILWAY_TOKEN"], "target"), note: null },
    { ...cloudflare, connectable: false, note: cloudflareNote },
  ];
}

/**
 * What this repository is, read from its own files.
 *
 * Section 39 asks for detection from actual repository files, and section 7
 * says never to invent a Node version. Everything below is either found in a
 * file or reported as absent; nothing is guessed to fill a field.
 */
async function detectBuildConfig() {
  const read = async (name: string): Promise<string | null> => {
    try {
      return await readFile(join(REPO_DIR, name), "utf8");
    } catch {
      return null;
    }
  };
  const exists = async (name: string): Promise<boolean> => {
    try {
      await stat(join(REPO_DIR, name));
      return true;
    } catch {
      return false;
    }
  };

  const [pkgRaw, nvmrc, nodeVersionFile] = await Promise.all([
    read("package.json"), read(".nvmrc"), read(".node-version"),
  ]);

  let pkg: Record<string, unknown> = {};
  try {
    pkg = pkgRaw ? (JSON.parse(pkgRaw) as Record<string, unknown>) : {};
  } catch {
    pkg = {};
  }
  const scripts = (pkg.scripts ?? {}) as Record<string, string>;
  const deps = {
    ...((pkg.dependencies ?? {}) as Record<string, string>),
    ...((pkg.devDependencies ?? {}) as Record<string, string>),
  };

  // Framework, from what is actually installed rather than from a guess at the
  // project's name.
  const framework =
    "@tanstack/react-start" in deps ? "TanStack Start"
      : "next" in deps ? "Next.js"
        : "nuxt" in deps ? "Nuxt"
          : "astro" in deps ? "Astro"
            : "vite" in deps ? "Vite"
              : "react" in deps ? "React" : null;

  const [hasPnpm, hasYarn, hasNpm, hasBun] = await Promise.all([
    exists("pnpm-lock.yaml"), exists("yarn.lock"),
    exists("package-lock.json"), exists("bun.lockb"),
  ]);
  const packageManager =
    (pkg.packageManager as string | undefined) ??
    (hasPnpm ? "pnpm" : hasYarn ? "yarn" : hasBun ? "bun" : hasNpm ? "npm" : null);

  // Section 7: declared and running are different facts and both are given.
  const engines = (pkg.engines ?? {}) as Record<string, string>;
  const declaredNode =
    nvmrc?.trim() || nodeVersionFile?.trim() || engines.node || null;

  // Which output directory is actually on disk, with its size.
  const candidates = [".output", "dist", "build", "out", ".next", "public"];
  const found: { dir: string; bytes: number | null }[] = [];
  for (const dir of candidates) {
    if (!(await exists(dir))) continue;
    let bytes: number | null = null;
    try {
      const entries = await readdir(join(REPO_DIR, dir), { withFileTypes: true });
      bytes = entries.length;
    } catch {
      bytes = null;
    }
    found.push({ dir, bytes });
  }

  return {
    framework,
    package_manager: packageManager,
    package_manager_evidence: {
      "pnpm-lock.yaml": hasPnpm, "yarn.lock": hasYarn,
      "package-lock.json": hasNpm, "bun.lockb": hasBun,
    },
    node: {
      declared: declaredNode,
      declared_in: nvmrc ? ".nvmrc" : nodeVersionFile ? ".node-version" : engines.node ? "package.json engines" : null,
      running: process.version,
      note: declaredNode
        ? null
        : "This repository does not declare a Node version — no .nvmrc, no .node-version and no engines field. The running version is reported instead of a number invented to fill the field.",
    },
    build_command: scripts.build ?? null,
    build_scripts: Object.fromEntries(
      Object.entries(scripts).filter(([k]) => /^(build|dev|start|preview)/.test(k)),
    ),
    output_dir: found[0]?.dir ?? null,
    output_candidates: found,
    detected_from: "package.json, lockfiles and the working tree on the host",
  };
}

/**
 * The environment this application actually needs.
 *
 * Scanned out of the source rather than typed into a list, so a variable that
 * a new endpoint starts reading turns up here without anybody remembering to
 * add it. Names and whether they are set - never a value.
 */
async function requiredEnvironment() {
  const names = new Set<string>();
  const walk = async (dir: string, depth = 0): Promise<void> => {
    if (depth > 6) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        try {
          const text = await readFile(full, "utf8");
          for (const match of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]{2,})/g)) {
            names.add(match[1]);
          }
        } catch {
          /* unreadable file, skipped */
        }
      }
    }
  };
  await walk(join(REPO_DIR, "src"));

  return [...names].sort().map((name) => ({
    name,
    set: Boolean(process.env[name]?.trim()),
    secret: /KEY|TOKEN|SALT|SECRET|PASSWORD/.test(name),
  }));
}

/* --------------------------------------------------------------- logs */

/**
 * Sanitise before anything leaves the server.
 *
 * Two passes. Known secret values are replaced by the name of the variable
 * they came from, which catches a credential however it was printed. Then
 * anything token-shaped is masked, which catches the ones this process never
 * knew about. Sections 12 and 37 both hang on this function, so it runs on
 * every line without exception.
 */
function sanitise(text: string): string {
  let out = text;
  for (const [name, value] of Object.entries(process.env)) {
    if (!value || value.length < 12) continue;
    if (!/KEY|TOKEN|SALT|SECRET|PASSWORD|DSN|URL/.test(name)) continue;
    out = out.split(value).join(`[redacted:${name}]`);
  }
  return out
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, "[redacted:jwt]")
    .replace(/\b(sb_secret|sb_publishable|sk_live|sk_test|rk_live|ghp|gho|glpat)_[A-Za-z0-9_-]{8,}/g, "[redacted:token]")
    .replace(/(authorization|apikey|api-key|cookie)(\s*[:=]\s*)\S+/gi, "$1$2[redacted]");
}

const LOG_FILES = [
  { name: "out", path: "/root/.pm2/logs/softwarevala-staging-out.log" },
  { name: "error", path: "/root/.pm2/logs/softwarevala-staging-error.log" },
];

/**
 * The runtime log, from the process manager that is the build and runtime
 * system here. No provider streams logs into this application, so section 16's
 * empty state is the honest answer for a build log and this is what does exist.
 */
async function runtimeLogs(lines: number) {
  const out: { file: string; entries: { severity: string; message: string }[]; error?: string }[] = [];
  for (const file of LOG_FILES) {
    try {
      const text = await readFile(file.path, "utf8");
      const tail = sanitise(text)
        // Strip terminal colour so the panel shows text rather than escapes.
        .replace(/\u001b\[[0-9;]*m/g, "")
        .split("\n")
        .filter((l) => l.trim())
        .slice(-lines);
      out.push({
        file: file.name,
        entries: tail.map((message) => ({
          severity: /error|fatal|exception/i.test(message) ? "ERROR"
            : /warn/i.test(message) ? "WARN"
              : /success|ready|listening/i.test(message) ? "SUCCESS" : "INFO",
          message,
        })),
      });
    } catch (error) {
      out.push({
        file: file.name, entries: [],
        error: error instanceof Error ? error.message : "unreadable",
      });
    }
  }
  return out;
}

/** Section 21: availability checked by requesting it, not assumed. */
async function healthCheck(target: string) {
  const started = Date.now();
  try {
    const response = await fetch(target, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    const latency = Date.now() - started;
    return {
      url: target,
      status: response.status,
      latency_ms: latency,
      state: response.ok ? (latency > 3000 ? "degraded" : "healthy") : "failed",
      checked_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      url: target,
      status: null,
      latency_ms: Date.now() - started,
      state: "failed",
      error: error instanceof Error ? error.message : "unreachable",
      checked_at: new Date().toISOString(),
    };
  }
}

const DOMAINS = ["https://softwarevala.net", "https://softwarewala.net"];

async function audit(request: Request, action: string, after: unknown, reason: string) {
  try {
    const authorization = request.headers.get("authorization");
    const anon =
      process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim() ?? "";
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
    const asOperator = Boolean(authorization && anon);
    await fetch(`${url()}/rest/v1/rpc/mm_audit`, {
      method: "POST",
      headers: asOperator
        ? { apikey: anon, Authorization: authorization!, "Content-Type": "application/json" }
        : { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_action: action, p_entity_type: "deployment", p_entity_id: null,
        p_before: null, p_after: after, p_reason: reason,
      }),
    });
  } catch (error) {
    console.error("[deployment] audit failed", error);
  }
}

export const Route = createFileRoute("/api/marketplace/deployment")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const may = (action: string) => {
          const d = resolveAction({ roles: caller.roles, action, permissions: matrix });
          return d.visible && d.enabled;
        };
        if (!may("view")) {
          await recordDenial(request, {
            action: "deployment_view", permission: "marketplace.view",
            roles: caller.roles, entityType: "deployment", recordId: null,
            why: `Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: "Permission marketplace.view is required." },
            { status: 403 },
          );
        }

        const panel = new URL(request.url).searchParams.get("panel");
        if (panel === "logs") {
          const lines = Math.min(500, Math.max(20, Number(new URL(request.url).searchParams.get("lines") ?? 120)));
          return Response.json({
            ok: true,
            source: "pm2",
            what:
              "These are the process manager's own logs for the running application. No deployment provider streams build logs here, so there are none to show; section 16's empty state is the honest answer for a build log.",
            sanitised: true,
            logs: await runtimeLogs(lines),
          });
        }

        const [repo, instances, deployments, demoDeployments, demoDomains, history, health, buildConfig, requiredEnv] =
          await Promise.all([
            repository(),
            rows<Record<string, unknown>>(
              "server_instances?select=server_code,server_name,hostname,provider,region_name,status,health_status,health_score,cpu_usage,ram_usage,disk_usage,error_rate,last_health_check,response_time_ms&limit=5",
            ),
            rows("server_deployments?select=id&limit=1"),
            rows("demo_deployments?select=id&limit=1"),
            rows<Record<string, unknown>>(
              "demo_domains?select=slug,hostname,environment,dns_status,status,expires_at,created_at,external&limit=50",
            ),
            rows<Record<string, unknown>>(
              "marketplace_audit_logs?select=action,actor,actor_role,reason,created_at&entity_type=eq.deployment&order=created_at.desc&limit=20",
            ),
            Promise.all(DOMAINS.map(healthCheck)),
            detectBuildConfig(),
            requiredEnvironment(),
          ]);

        const credentials = providerCredentials();
        const instance = instances[0] ?? null;

        // Environment variables: names and whether they are set. Never values -
        // section 17 lists browser source, logs and exports, and this is all
        // three at once if it carries a value.
        const environment = [
          "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY",
          "SUPABASE_SERVICE_ROLE_KEY", "INTERNAL_API_TOKEN",
          "TRANSLATE_PROVIDER_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
          "GOOGLE_AI_API_KEY", "PAYU_MERCHANT_KEY", "PAYU_MERCHANT_SALT",
          "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_ZONE_ID",
          "GITHUB_TOKEN", "VERCEL_TOKEN", "NETLIFY_TOKEN", "RAILWAY_TOKEN",
        ].map((name) => ({
          name,
          set: Boolean(process.env[name]?.trim()),
          secret: /KEY|TOKEN|SALT|SECRET/.test(name),
        }));

        return Response.json({
          ok: true,
          metrics: {
            production_instances: instances.length,
            preview_builds: demoDeployments.length,
            build_records: deployments.length,
            health: health.every((h) => h.state === "healthy") ? "healthy"
              : health.some((h) => h.state === "failed") ? "failed" : "degraded",
            average_build_time_ms: null,
            average_build_note:
              "server_deployments and demo_deployments are both empty. No build has ever been recorded here, so there is no average to report.",
          },
          pipeline: {
            what:
              "This application ships by git pull, npm run build and pm2 restart onto one VPS. That is the deployment, and every part of it below is read rather than described.",
            host: instance,
            repo_dir: REPO_DIR,
          },
          repository: repo,
          build_config: buildConfig,
          required_environment: requiredEnv,
          providers: credentials,
          environment,
          domains: health.map((h) => ({
            ...h,
            // Reported from the check, never assumed. TLS terminating at all is
            // what an https request succeeding demonstrates.
            https: h.status !== null,
          })),
          demo_urls: demoDomains,
          history,
          capabilities: {
            deploy_from_ui: {
              available: false,
              reason:
                "No deployment provider has a credential here, and the real pipeline is a shell sequence on the host. Firing git pull, a build and a pm2 restart from a web request would take the site down on a bad build with no way back, so it is not offered.",
            },
            rollback: {
              available: false,
              reason: "Rollback belongs to a deployment provider, and none is connected. Git history is intact, so a rollback is a checkout and a rebuild on the host.",
            },
            build_logs: {
              available: false,
              reason: "No build record has ever been written to server_deployments, and no provider streams logs here. Inventing a log is the exact thing this brief forbids.",
            },
            health_check: { available: true, reason: null },
            repository_read: { available: true, reason: null },
            config_detection: { available: true, reason: null },
            runtime_logs: {
              available: true,
              reason:
                "Logs from the process manager that runs this application, sanitised. Not build logs: no provider produces those here.",
            },
          },
          permissions: { view: true, check: may("settings_manage"), export: may("export") },
        });
      },

      /** The one real action: check whether the live site actually answers. */
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { action?: string; url?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const decision = resolveAction({
          roles: caller.roles, action: "settings_manage", permissions: matrix,
        });
        if (!decision.visible || !decision.enabled) {
          await recordDenial(request, {
            action: "deployment_health_check", permission: "marketplace.settings.manage",
            roles: caller.roles, entityType: "deployment", recordId: null,
            why: `${decision.reason ?? "Refused."} Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: decision.reason },
            { status: 403 },
          );
        }

        /**
         * Section 14, run for real.
         *
         * Every gate is checked and the answer is the answer; the run stops at
         * the provider gate because that is where it genuinely stops. Reporting
         * a deployment as started when no provider can receive it would be the
         * one thing this brief forbids most plainly.
         */
        if (body.action === "validate") {
          const [repo, config, required] = await Promise.all([
            repository(), detectBuildConfig(), requiredEnvironment(),
          ]);
          const providers = providerCredentials();
          const target = providers.find((p) => p.kind === "target" && p.connectable) ?? null;
          const missingRequired = required.filter((v) => !v.set);

          const gates = [
            { gate: "Repository exists", pass: repo.connected, detail: repo.remote ?? "no git remote" },
            { gate: "Provider connected", pass: providers.some((p) => p.kind === "git" && p.connectable), detail: "No GITHUB_TOKEN or GITLAB_TOKEN is set. The checkout is readable on the host, but no provider API can be called." },
            { gate: "Branch exists", pass: Boolean(repo.current_branch), detail: repo.current_branch ?? "no branch" },
            { gate: "Build command", pass: Boolean(config.build_command), detail: config.build_command ?? "none in package.json" },
            { gate: "Output directory", pass: Boolean(config.output_dir), detail: config.output_dir ?? "none on disk" },
            { gate: "Required environment", pass: missingRequired.length === 0, detail: missingRequired.length ? `${missingRequired.length} of ${required.length} not set: ${missingRequired.slice(0, 6).map((v) => v.name).join(", ")}${missingRequired.length > 6 ? "…" : ""}` : `all ${required.length} set` },
            { gate: "Working tree clean", pass: repo.working_tree_clean, detail: repo.working_tree_clean ? "clean" : `${repo.uncommitted_files} uncommitted file(s)` },
            { gate: "Deployment target connected", pass: Boolean(target), detail: target ? target.name : "None of Vercel, Netlify, Railway or Cloudflare has a usable credential." },
          ];

          const failed = gates.filter((g) => !g.pass);
          await audit(request, "Deployment validation", { gates, failed: failed.length },
            failed.length === 0
              ? "Every pre-deployment gate passed."
              : `Validation stopped: ${failed.map((g) => g.gate).join(", ")}.`);

          return Response.json({
            ok: true,
            action: "validate",
            gates,
            passed: gates.length - failed.length,
            failed: failed.length,
            can_deploy: failed.length === 0,
            message: failed.length === 0
              ? "Every gate passed."
              : `Deployment would stop here. ${failed.length} gate(s) did not pass, and nothing was started.`,
          });
        }

        if (body.action !== "health_check") {
          return Response.json(
            {
              ok: false, reason: "unsupported_action",
              message: "Only health_check and validate run from here. Deploying and rolling back need a provider credential this environment does not have, and the real pipeline runs on the host.",
            },
            { status: 400 },
          );
        }

        // Only the domains this platform owns. An arbitrary URL would make this
        // endpoint a request forwarder for anyone who reaches it.
        const target = String(body.url ?? DOMAINS[0]);
        if (!DOMAINS.includes(target)) {
          return Response.json(
            { ok: false, reason: "unknown_domain", message: "That is not one of this platform's domains." },
            { status: 400 },
          );
        }

        const result = await healthCheck(target);
        await audit(request, "Deployment health check", result,
          `${target} answered ${result.status ?? "nothing"} in ${result.latency_ms} ms.`);
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
