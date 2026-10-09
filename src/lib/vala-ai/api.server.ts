import { existsSync, readFileSync } from "node:fs";
import { listAudit, verifyAuditChain } from "./audit.server.ts";
import { recordPerson, requireRole, type Operator, type Role } from "./auth.server.ts";
import * as chatApi from "./chat.server.ts";
import { dataDir } from "./config.server.ts";
import { all, schemaVersion } from "./db.server.ts";
import {
  decideApproval,
  getRelease,
  listApprovals,
  listReleases,
  requestRelease,
  requestRollback,
} from "./governance.server.ts";
import { modelStatus } from "./model.server.ts";
import {
  approveRequirement,
  createProject,
  decideChangeRequest,
  getProject,
  listChangeRequests,
  listProjects,
  listRequirements,
  raiseChangeRequest,
  retryWorkspace,
  saveDraft,
} from "./projects.server.ts";
import { getSettings, resources, updateSettings } from "./settings.server.ts";
import {
  createTask,
  getEvidence,
  getTask,
  listEvidence,
  listTasks,
  requestCancel,
  resumeTask,
  STATES,
  taskEvents,
  verificationOf,
} from "./tasks.server.ts";
import { sha256, ValaError } from "./util.server.ts";
import { abortRunning, ensureWorker, workerStatus } from "./worker.server.ts";
import {
  changedFiles,
  commitLog,
  diffBetween,
  getWorkspace,
  headCommit,
  listFiles,
  readWorkspaceFile,
  requireReadyWorkspace,
} from "./workspace.server.ts";

/**
 * The whole Vala AI HTTP surface: /api/vala-ai/<path>.
 *
 * The caller comes from the Control Panel session (bearer token), resolved by
 * the function the route passes in; every handler's role is checked here, on
 * the server. No cookie is used, so a cross-site request carries no identity.
 */

type Ctx = {
  req: Request;
  url: URL;
  op: Operator | null;
  params: Record<string, string>;
  body: Record<string, unknown>;
};
type Handler = (ctx: Ctx) => Promise<unknown> | unknown;
type Route = {
  method: string;
  pattern: RegExp;
  keys: string[];
  minRole: Role | null;
  handler: Handler;
};

const routes: Route[] = [];
function on(method: string, path: string, minRole: Role | null, handler: Handler) {
  const keys: string[] = [];
  const pattern = new RegExp(
    "^" +
      path.replace(/:([a-zA-Z]+)/g, (_, k) => {
        keys.push(k);
        return "([^/]+)";
      }) +
      "$",
  );
  routes.push({ method, pattern, keys, minRole, handler });
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** What is actually built, so the UI never presents planned work as working. */
const CAPABILITIES = [
  { area: "Control Panel sign-in with server-side Vala AI roles", status: "built" },
  { area: "Projects with permanent IDs, isolated git workspaces", status: "built" },
  { area: "Requirements, scope lock, change requests", status: "built" },
  { area: "Agent loop on local model (plan → build → test → fix → verify)", status: "built" },
  { area: "Durable task states, leases, crash recovery, cancel", status: "built" },
  {
    area: "Evidence (stored output + SHA-256) and independent re-run verification",
    status: "built",
  },
  { area: "Approvals with recorded scope, evidence and outcome", status: "built" },
  { area: "Immutable releases (patch + hash) and verified workspace rollback", status: "built" },
  { area: "Hash-chained audit log", status: "built" },
  { area: "Resource floors (disk, memory), timeouts, write budgets", status: "built" },
  {
    area: "Live running preview of client apps",
    status: "not built",
    note: "Preview is the verified diff and file view.",
  },
  {
    area: "Orchestration of existing worker agents",
    status: "not built",
    note: "Existing workers depend on the discontinued database.",
  },
  {
    area: "OS-level sandbox for commands",
    status: "not built",
    note: "Commands run in the workspace with a scrubbed environment, without a container.",
  },
  { area: "Licensing & delivery", status: "not built" },
  {
    area: "Production deployment of Vala AI",
    status: "not built",
    note: "Requires separate authorization.",
  },
  {
    area: "Source-code library indexing (3,000+ codebases)",
    status: "not built",
    note: "Last phase.",
  },
] as const;

// ---- session ------------------------------------------------------------
on("GET", "/session", null, ({ op }) => ({ operator: op }));

// ---- system -------------------------------------------------------------
on("GET", "/status", "viewer", async () => {
  const counts = all<{ state: string; n: number }>(
    "select state, count(*) as n from tasks group by state",
  );
  return {
    model: await modelStatus(),
    worker: workerStatus(),
    resources: resources(),
    schemaVersion: schemaVersion(),
    dataDir: dataDir(),
    audit: verifyAuditChain(),
    tasksByState: Object.fromEntries(
      STATES.map((s) => [s, Number(counts.find((c) => c.state === s)?.n ?? 0)]),
    ),
    projects: listProjects().length,
    pendingApprovals: listApprovals("pending").length,
    openChangeRequests: listChangeRequests().filter((c) => c.status === "open").length,
    capabilities: CAPABILITIES,
  };
});
on("GET", "/settings", "viewer", () => getSettings());
on("PATCH", "/settings", "owner", ({ body, op }) => updateSettings(body, op!.id));
on("GET", "/people", "viewer", () =>
  all("select id, email, role, last_seen_at from people order by last_seen_at desc"),
);

// ---- projects -----------------------------------------------------------
on("GET", "/projects", "viewer", () => listProjects());
on("POST", "/projects", "operator", ({ body, op }) =>
  createProject(
    {
      name: str(body.name),
      description: str(body.description),
      sourceKind: str(body.sourceKind) as "git" | "empty",
      sourcePath: str(body.sourcePath) || null,
    },
    op!,
  ),
);
on("GET", "/projects/:id", "viewer", ({ params }) => {
  const project = getProject(params.id);
  const workspace = getWorkspace(project.id) ?? null;
  return {
    project,
    workspace,
    requirements: listRequirements(project.id),
    changeRequests: listChangeRequests(project.id),
    tasks: listTasks({ projectId: project.id }),
    checkpoints: all(
      "select * from checkpoints where project_id = ? order by created_at desc limit 100",
      project.id,
    ),
    releases: listReleases(project.id),
    uncommitted: workspace?.status === "ready" ? changedFiles(workspace) : [],
  };
});
on("POST", "/projects/:id/workspace/retry", "operator", ({ params, op }) =>
  retryWorkspace(params.id, op!),
);
on("GET", "/projects/:id/files", "viewer", ({ params }) =>
  listFiles(requireReadyWorkspace(params.id)),
);
on("GET", "/projects/:id/file", "viewer", ({ params, url }) =>
  readWorkspaceFile(requireReadyWorkspace(params.id), url.searchParams.get("path") ?? ""),
);
on("GET", "/projects/:id/log", "viewer", ({ params }) =>
  commitLog(requireReadyWorkspace(params.id)),
);
on("GET", "/projects/:id/diff", "viewer", ({ params, url }) => {
  const ws = requireReadyWorkspace(params.id);
  return diffBetween(
    ws,
    url.searchParams.get("from") || ws.base_commit || "",
    url.searchParams.get("to") || headCommit(ws),
  );
});
on("POST", "/projects/:id/requirements", "operator", ({ params, body, op }) =>
  saveDraft(
    params.id,
    {
      requirementId: str(body.requirementId) || undefined,
      title: str(body.title),
      body: str(body.body),
      checks: body.checks,
    },
    op!,
  ),
);
on("POST", "/requirements/:id/approve", "owner", ({ params, op }) =>
  approveRequirement(params.id, op!),
);
on("POST", "/projects/:id/change-requests", "operator", ({ params, body, op }) =>
  raiseChangeRequest(
    params.id,
    { reason: str(body.reason), title: str(body.title), body: str(body.body), checks: body.checks },
    op!.id,
  ),
);
on("GET", "/change-requests", "viewer", () => listChangeRequests());
on("POST", "/change-requests/:id/decide", "owner", ({ params, body, op }) =>
  decideChangeRequest(params.id, Boolean(body.approve), op!),
);
on("POST", "/projects/:id/rollback", "operator", ({ params, body, op }) =>
  requestRollback(params.id, str(body.commit), str(body.reason), op!),
);

// ---- tasks & evidence ---------------------------------------------------
on("GET", "/tasks", "viewer", ({ url }) =>
  listTasks({
    projectId: url.searchParams.get("projectId") ?? undefined,
    state: url.searchParams.get("state") ?? undefined,
  }),
);
on("POST", "/projects/:id/tasks", "operator", ({ params, body, op }) =>
  createTask(params.id, { title: str(body.title), instruction: str(body.instruction) }, op!),
);
on("GET", "/tasks/:id", "viewer", ({ params }) => {
  const task = getTask(params.id);
  return {
    task,
    project: getProject(task.project_id),
    events: taskEvents(task.id),
    evidence: listEvidence({ taskId: task.id }),
    verification: verificationOf(task),
  };
});
on("POST", "/tasks/:id/cancel", "operator", ({ params, op }) => {
  const t = requestCancel(params.id, op!);
  abortRunning(params.id);
  return t;
});
on("POST", "/tasks/:id/resume", "operator", ({ params, op }) => resumeTask(params.id, op!));
on("POST", "/tasks/:id/release", "operator", ({ params, body, op }) =>
  requestRelease(params.id, str(body.label), op!),
);
on("GET", "/evidence", "viewer", ({ url }) =>
  listEvidence({ projectId: url.searchParams.get("projectId") ?? undefined }),
);
on("GET", "/evidence/:id/output", "viewer", ({ params }) => {
  const ev = getEvidence(params.id);
  if (!existsSync(ev.output_path)) return { content: null, sha256Matches: false, missing: true };
  const content = readFileSync(ev.output_path, "utf8");
  return { content, sha256Matches: sha256(content) === ev.output_sha256, missing: false };
});

// ---- approvals & releases -----------------------------------------------
on("GET", "/approvals", "viewer", ({ url }) =>
  listApprovals(url.searchParams.get("status") ?? undefined),
);
on("POST", "/approvals/:id/decide", "owner", ({ params, body, op }) =>
  decideApproval(
    params.id,
    {
      approve: Boolean(body.approve),
      note: str(body.note),
      evidenceReviewed: Array.isArray(body.evidenceReviewed)
        ? body.evidenceReviewed.map(String)
        : [],
    },
    op!,
  ),
);
on("GET", "/releases", "viewer", () => listReleases());
on("GET", "/releases/:id/patch", "viewer", ({ params }) => {
  const r = getRelease(params.id);
  if (!existsSync(r.patch_path)) throw new ValaError(410, "The patch file is missing from disk.");
  const patch = readFileSync(r.patch_path, "utf8");
  if (sha256(patch) !== r.patch_sha256)
    throw new ValaError(409, "The patch file no longer matches its recorded hash.");
  return new Response(patch, {
    headers: {
      "content-type": "text/x-diff; charset=utf-8",
      "content-disposition": `attachment; filename="${r.id}.patch"`,
    },
  });
});

// ---- chat & audit -------------------------------------------------------
on("GET", "/chat", "viewer", ({ url }) =>
  chatApi.history(url.searchParams.get("projectId") || null),
);
on("POST", "/chat", "operator", ({ body, op }) =>
  chatApi.send(str(body.projectId) || null, str(body.text), op!),
);
on("GET", "/audit", "viewer", ({ url }) => ({
  entries: listAudit(200, Number(url.searchParams.get("before")) || undefined),
  chain: verifyAuditChain(),
}));

// ---- dispatcher ---------------------------------------------------------
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });

export type ResolveCaller = (req: Request) => Promise<Operator | null>;

export async function handleApi(
  req: Request,
  resolveCaller: ResolveCaller,
  prefix = "/api/vala-ai",
): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.slice(prefix.length).replace(/\/+$/, "") || "/";
  const method = req.method.toUpperCase();
  try {
    ensureWorker();
    let body: Record<string, unknown> = {};
    if (method !== "GET") {
      const text = await req.text();
      if (text.length > 512_000) throw new ValaError(413, "Request body too large.");
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          throw new ValaError(400, "Body must be JSON.");
        }
      }
    }

    const op = await resolveCaller(req);
    if (op) recordPerson(op);
    for (const route of routes) {
      if (route.method !== method) continue;
      const m = route.pattern.exec(path);
      if (!m) continue;
      if (route.minRole) requireRole(op, route.minRole);
      const params = Object.fromEntries(
        route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]),
      );
      const out = await route.handler({ req, url, op, params, body });
      return out instanceof Response ? out : json(out ?? { ok: true });
    }
    throw new ValaError(404, `No Vala AI endpoint ${method} ${path}.`);
  } catch (e) {
    if (e instanceof ValaError) return json({ error: e.message }, e.status);
    console.error("[vala-ai]", method, path, e);
    return json({ error: "Internal error. The server log has the details." }, 500);
  }
}
