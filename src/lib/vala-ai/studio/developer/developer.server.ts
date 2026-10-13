import { z } from "zod";
import { createHash } from "node:crypto";
import type { Operator } from "../../auth.server";
import { studioStore } from "../store.server";
import { structured } from "@/lib/vala-ai/studio/ai/agent.server";

const admin = async () => {
  const { requireStudioRole } = await import("../auth.functions");
  const { studioStore } = await import("../store.server");
  return studioStore(await requireStudioRole("viewer"));
};

export async function audit(
  action: string,
  details: Record<string, unknown>,
  projectId?: string | null,
) {
  const db = await admin();
  await db
    .from("dev_audit_logs")
    .insert({ action, details: details as never, project_id: projectId ?? null });
}

// ---------- Library index ----------
export const libraryItemInput = z.object({
  source_key: z.string().min(1).max(300),
  name: z.string().min(1).max(300),
  category: z.string().max(200).nullish(),
  modules: z.array(z.string().max(200)).max(200).default([]),
  features: z.array(z.string().max(200)).max(400).default([]),
  technology: z.array(z.string().max(100)).max(50).default([]),
  database_engine: z.string().max(100).nullish(),
  framework: z.string().max(100).nullish(),
  capabilities: z.array(z.string().max(200)).max(200).default([]),
  source_location: z.string().min(1).max(1000),
  version: z.string().max(100).nullish(),
  compatibility: z.string().max(1000).nullish(),
  known_requirements: z.string().max(2000).nullish(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type LibraryItemInput = z.infer<typeof libraryItemInput>;

export async function importLibrary(items: LibraryItemInput[]) {
  const db = await admin();
  const n = (v: string | null | undefined) => v ?? null;
  const rows = items.map((i) => ({
    ...i,
    category: n(i.category),
    database_engine: n(i.database_engine),
    framework: n(i.framework),
    version: n(i.version),
    compatibility: n(i.compatibility),
    known_requirements: n(i.known_requirements),
    metadata: i.metadata as never,
    indexed_at: new Date().toISOString(),
  }));
  const { error } = await db.from("library_items").upsert(rows, { onConflict: "source_key" });
  if (error) throw new Error("Library import failed: " + error.message);
  await audit("library.import", { count: items.length });
  const { count } = await db.from("library_items").select("id", { count: "exact", head: true });
  return { imported: items.length, total: count ?? 0 };
}

// ---------- Projects + requirements ----------
const analysisSchema = z.object({
  summary: z.string(),
  category: z.string(),
  modules: z.array(z.string()),
  features: z.array(z.string()),
  technology: z.array(z.string()),
  database: z.string().nullable(),
  branding: z.object({
    name: z.string().nullable(),
    colors: z.array(z.string()),
    notes: z.string().nullable(),
  }),
  keywords: z.array(z.string()),
  business_type: z.string(),
  optional_features: z.array(z.string()),
  deployment: z.array(z.string()),
  missing_info: z.array(z.string()),
});
export type Analysis = z.infer<typeof analysisSchema>;

export async function upsertClient(
  c: {
    external_id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    data?: Record<string, unknown>;
    source?: string;
  },
  operator?: Operator,
) {
  const db = operator ? studioStore(operator) : await admin();
  const { data, error } = await db
    .from("dev_clients")
    .upsert(
      {
        external_id: c.external_id,
        name: c.name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        data: (c.data ?? {}) as never,
        source: c.source ?? "local",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "external_id" },
    )
    .select()
    .single();
  if (error || !data) throw new Error("Client save failed.");
  return data;
}
export const clientKey = (name: string) =>
  "local:" + name.trim().toLowerCase().replace(/\s+/g, " ");

export async function createProject(input: {
  name: string;
  client_name?: string | null | undefined;
  requirement: string;
}) {
  const db = await admin();
  const client = input.client_name?.trim()
    ? await upsertClient({
        external_id: clientKey(input.client_name),
        name: input.client_name.trim(),
      })
    : null;
  const { data: project, error } = await db
    .from("dev_projects")
    .insert({
      name: input.name,
      client_name: input.client_name ?? null,
      client_id: client?.id ?? null,
    })
    .select()
    .single();
  if (error || !project) throw new Error("Project create failed.");
  const { data: req, error: e2 } = await db
    .from("dev_requirements")
    .insert({ project_id: project.id, raw_text: input.requirement })
    .select()
    .single();
  if (e2 || !req) throw new Error("Requirement save failed.");
  await audit(
    "project.create",
    { project_code: project.project_code, name: input.name },
    project.id,
  );
  return { project, requirement: req };
}

export async function analyzeRequirement(requirementId: string) {
  const db = await admin();
  const { data: req } = await db
    .from("dev_requirements")
    .select("*")
    .eq("id", requirementId)
    .single();
  if (!req) throw new Error("Requirement not found.");
  const { out } = await structured(
    analysisSchema,
    `You are the requirement analyst of a software factory. Extract what software is being asked for. Use short lowercase terms for modules, features, technology and keywords (e.g. "inventory", "pos", "multi-vendor", "php"). Only include what the requirement states or clearly implies. business_type is a short human label (e.g. "School"). optional_features = nice-to-haves. deployment = hosting/domain needs stated. missing_info = questions the client must still answer (brand name, logo, hosting, users, etc.). Do NOT write code.`,
    req.raw_text,
  );
  await db
    .from("dev_requirements")
    .update({ analysis: out as never })
    .eq("id", requirementId);
  await db
    .from("dev_projects")
    .update({
      status: "analyzed",
      branding: out.branding as never,
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.project_id);
  await audit(
    "requirement.analyze",
    { requirement_id: requirementId, category: out.category },
    req.project_id,
  );
  return out;
}

export async function answerMissing(requirementId: string, answers: { q: string; a: string }[]) {
  const db = await admin();
  const { data: req } = await db
    .from("dev_requirements")
    .select("raw_text, project_id")
    .eq("id", requirementId)
    .single();
  if (!req) throw new Error("Requirement not found.");
  const filled = answers.filter((x) => x.a.trim());
  if (!filled.length) throw new Error("Fill at least one answer.");
  const raw_text = `${req.raw_text}\n\nClient answers:\n${filled.map((x) => `- ${x.q} → ${x.a.trim()}`).join("\n")}`;
  await db.from("dev_requirements").update({ raw_text }).eq("id", requirementId);
  await audit(
    "requirement.answers",
    { requirement_id: requirementId, count: filled.length },
    req.project_id,
  );
  return analyzeRequirement(requirementId);
}

// ---------- Matching (deterministic, with evidence) ----------
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim();
const tokens = (arr: (string | null | undefined)[]) =>
  new Set(
    arr
      .filter(Boolean)
      .flatMap((s) => norm(s!).split(" "))
      .filter((t) => t.length > 1),
  );

const WEIGHTS = {
  category: 4,
  modules: 3,
  features: 2,
  technology: 2,
  database: 1,
  keywords: 1,
} as const;

export async function matchRequirement(requirementId: string) {
  const db = await admin();
  const { data: req } = await db
    .from("dev_requirements")
    .select("*")
    .eq("id", requirementId)
    .single();
  if (!req?.analysis) throw new Error("Analyze the requirement first.");
  const a = req.analysis as unknown as Analysis;
  const { data: items, error } = await db.from("library_items").select("*").limit(20000);
  if (error) throw new Error("Library read failed.");
  if (!items?.length) return { matches: [], librarySize: 0 };

  const want = {
    category: tokens([a.category]),
    modules: tokens(a.modules),
    features: tokens(a.features),
    technology: tokens(a.technology),
    database: tokens([a.database]),
    keywords: tokens(a.keywords),
  };
  const maxScore =
    (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce(
      (n, k) => n + (want[k].size ? WEIGHTS[k] : 0),
      0,
    ) || 1;

  const scored = items.map((it) => {
    const have = {
      category: tokens([it.category]),
      modules: tokens(it.modules),
      features: tokens([...it.features, ...it.capabilities]),
      technology: tokens([...it.technology, it.framework]),
      database: tokens([it.database_engine]),
      keywords: tokens([
        it.name,
        it.category,
        ...it.modules,
        ...it.features,
        ...it.capabilities,
        it.known_requirements,
      ]),
    };
    const evidence: { field: string; matched: string[]; missing: string[]; weight: number }[] = [];
    let score = 0;
    for (const k of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) {
      if (!want[k].size) continue;
      const matched = [...want[k]].filter((t) => have[k].has(t));
      const missing = [...want[k]].filter((t) => !have[k].has(t));
      const part = (matched.length / want[k].size) * WEIGHTS[k];
      score += part;
      evidence.push({ field: k, matched, missing, weight: WEIGHTS[k] });
    }
    return { item: it, score: Math.round((score / maxScore) * 1000) / 10, evidence };
  });
  const top = scored
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 5);

  await db.from("dev_matches").delete().eq("requirement_id", requirementId);
  if (top.length) {
    await db.from("dev_matches").insert(
      top.map((t) => ({
        project_id: req.project_id,
        requirement_id: requirementId,
        item_id: t.item.id,
        score: t.score,
        evidence: t.evidence as never,
      })),
    );
  }
  await audit(
    "library.match",
    {
      requirement_id: requirementId,
      candidates: top.map((t) => ({ source_key: t.item.source_key, score: t.score })),
    },
    req.project_id,
  );
  return {
    matches: top.map((t) => ({
      id: t.item.id,
      name: t.item.name,
      source_key: t.item.source_key,
      source_location: t.item.source_location,
      score: t.score,
      evidence: t.evidence,
    })),
    librarySize: items.length,
  };
}

export async function selectSource(projectId: string, itemId: string) {
  const db = await admin();
  await db.from("library_items").select().eq("id", itemId).single();
  await db.from("dev_projects").select().eq("id", projectId).single();
  const { error } = await db
    .from("dev_projects")
    .update({
      selected_item_id: itemId,
      status: "source_selected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
  if (error) throw new Error("Select failed.");
  await audit("project.select_source", { item_id: itemId }, projectId);
}

// ---------- Versions (append-only) ----------
export async function createVersion(input: {
  projectId: string;
  change_history: string;
  test_status: string;
  delivery_status: string;
  license_info: Record<string, unknown>;
  build_info: Record<string, unknown>;
}) {
  const db = await admin();
  const { count } = await db
    .from("dev_versions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", input.projectId);
  const { data: proj } = await db
    .from("dev_projects")
    .select("project_code")
    .eq("id", input.projectId)
    .single();
  const version_code = `${proj?.project_code ?? "SV-PROJECT"}-V${String((count ?? 0) + 1).padStart(3, "0")}`;
  const release_id = `SV-REL-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const { data, error } = await db
    .from("dev_versions")
    .insert({
      project_id: input.projectId,
      version_code,
      release_id,
      change_history: input.change_history,
      test_status: input.test_status,
      delivery_status: input.delivery_status,
      license_info: input.license_info as never,
      build_info: input.build_info as never,
    })
    .select()
    .single();
  if (error || !data) throw new Error("Version create failed.");
  await audit("version.create", { version_code, release_id }, input.projectId);
  return data;
}

// ---------- Reads ----------
export async function dashboard() {
  const db = await admin();
  const [lib, projects, versions, logs] = await Promise.all([
    db.from("library_items").select("id", { count: "exact", head: true }),
    db
      .from("dev_projects")
      .select("*, dev_clients(id, external_id, name, email, phone, source)")
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("dev_versions").select("*").order("created_at", { ascending: false }).limit(200),
    db.from("dev_audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  return {
    librarySize: lib.count ?? 0,
    projects: projects.data ?? [],
    versions: versions.data ?? [],
    logs: logs.data ?? [],
  };
}

export async function projectDetail(projectId: string) {
  const db = await admin();
  const [p, reqs, matches, versions, logs] = await Promise.all([
    db.from("dev_projects").select("*").eq("id", projectId).single(),
    db
      .from("dev_requirements")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    db
      .from("dev_matches")
      .select("*, library_items(name, source_key, source_location)")
      .eq("project_id", projectId)
      .order("score", { ascending: false }),
    db
      .from("dev_versions")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    db
      .from("dev_audit_logs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (!p.data) throw new Error("Project not found.");
  return {
    project: p.data,
    requirements: reqs.data ?? [],
    matches: matches.data ?? [],
    versions: versions.data ?? [],
    logs: logs.data ?? [],
  };
}

// ---------- Isolated project workspace ----------
export type WsFile = { path: string; content: string };
export type Branding = {
  name: string;
  primary: string;
  secondary: string;
  tagline?: string | null | undefined;
};

export async function createWorkspace(projectId: string, files: WsFile[]) {
  const db = await admin();
  const { data: p } = await db
    .from("dev_projects")
    .select("selected_item_id")
    .eq("id", projectId)
    .single();
  if (!p?.selected_item_id) throw new Error("Select a source software first.");
  const { error } = await db.from("dev_workspaces").upsert(
    {
      project_id: projectId,
      item_id: p.selected_item_id,
      files: files as never,
      branding: {} as never,
      changes: [] as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id" },
  );
  if (error) throw new Error("Workspace save failed: " + error.message);
  await db
    .from("dev_projects")
    .update({ status: "workspace_ready", updated_at: new Date().toISOString() })
    .eq("id", projectId);
  await audit("workspace.create", { files: files.length, item_id: p.selected_item_id }, projectId);
  return { files: files.length };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function applyBranding(projectId: string, b: Branding) {
  const db = await admin();
  const { data: ws } = await db
    .from("dev_workspaces")
    .select("*, library_items(name)")
    .eq("project_id", projectId)
    .single();
  if (!ws) throw new Error("Create the workspace first.");
  const original = (ws.library_items as { name: string } | null)?.name ?? "";
  const files = ws.files as unknown as WsFile[];
  const changes: { path: string; replacements: number }[] = [];
  const re = original.trim().length > 2 ? new RegExp(esc(original.trim()), "gi") : null;
  const next = files.map((f) => {
    if (!re) return f;
    const n = (f.content.match(re) ?? []).length;
    if (!n) return f;
    changes.push({ path: f.path, replacements: n });
    return { ...f, content: f.content.replace(re, b.name) };
  });
  const css = `/* Generated by Software Vala — project branding */\n:root {\n  --brand-name: "${b.name.replace(/"/g, "")}";\n  --brand-primary: ${b.primary};\n  --brand-secondary: ${b.secondary};\n}\n`;
  const i = next.findIndex((f) => f.path === "branding.css");
  if (i >= 0) next[i] = { path: "branding.css", content: css };
  else next.push({ path: "branding.css", content: css });
  changes.push({ path: "branding.css", replacements: 1 });
  const { error } = await db
    .from("dev_workspaces")
    .update({
      files: next as never,
      branding: b as never,
      changes: changes as never,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId);
  if (error) throw new Error("Branding save failed.");
  await db
    .from("dev_projects")
    .update({ branding: b as never, status: "branded", updated_at: new Date().toISOString() })
    .eq("id", projectId);
  await audit(
    "workspace.brand",
    { name: b.name, primary: b.primary, files_changed: changes.length },
    projectId,
  );
  return { changes, original };
}

export async function getWorkspace(projectId: string) {
  const db = await admin();
  const { data } = await db
    .from("dev_workspaces")
    .select("*, library_items(name, source_location)")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!data) return null;
  return {
    ...data,
    files: data.files as unknown as WsFile[],
    changes: data.changes as unknown as { path: string; replacements: number }[],
    branding: data.branding as unknown as Partial<Branding>,
  };
}

// ---------- Post-setup workflow: AI development → testing → bug fixing → delivery ----------
const fileListSchema = z.object({
  summary: z.string(),
  files: z.array(z.object({ path: z.string(), content: z.string(), reason: z.string() })),
});
const testSchema = z.object({
  passed: z.boolean(),
  summary: z.string(),
  issues: z.array(
    z.object({
      severity: z.enum(["high", "medium", "low"]),
      path: z.string(),
      problem: z.string(),
    }),
  ),
});
export type TestReport = z.infer<typeof testSchema>;

async function loadWs(projectId: string) {
  const db = await admin();
  const [ws, req] = await Promise.all([
    db.from("dev_workspaces").select("*").eq("project_id", projectId).maybeSingle(),
    db
      .from("dev_requirements")
      .select("raw_text, analysis")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!ws.data) throw new Error("Create the project workspace first.");
  return {
    db,
    ws: ws.data,
    files: ws.data.files as unknown as WsFile[],
    requirement: req.data?.raw_text ?? "",
  };
}
const digest = (files: WsFile[], max = 60000) => {
  let out = "",
    n = 0;
  for (const f of files) {
    const chunk = `--- ${f.path} ---\n${f.content.slice(0, 6000)}\n\n`;
    if (n + chunk.length > max) break;
    out += chunk;
    n += chunk.length;
  }
  return out;
};
const CAP = 20000;
const codeDiff = (files: WsFile[], upd: { path: string; content: string; reason: string }[]) =>
  upd.map((u) => ({
    path: u.path,
    reason: u.reason,
    before: (files.find((f) => f.path === u.path)?.content ?? "").slice(0, CAP),
    after: u.content.slice(0, CAP),
    isNew: !files.some((f) => f.path === u.path),
  }));
const merge = (files: WsFile[], upd: { path: string; content: string }[]) => {
  const next = [...files];
  for (const u of upd) {
    const i = next.findIndex((f) => f.path === u.path);
    if (i >= 0) next[i] = { path: u.path, content: u.content };
    else next.push({ path: u.path, content: u.content });
  }
  return next;
};
async function saveStage(
  projectId: string,
  files: WsFile[],
  status: string,
  action: string,
  details: Record<string, unknown>,
  changes?: unknown,
) {
  const db = await admin();
  const patch: Record<string, unknown> = { files, updated_at: new Date().toISOString() };
  if (changes) patch["changes"] = changes;
  await db
    .from("dev_workspaces")
    .update(patch as never)
    .eq("project_id", projectId);
  await db
    .from("dev_projects")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  await audit(action, details, projectId);
}

export async function developWorkspace(projectId: string) {
  const { files, requirement } = await loadWs(projectId);
  const { out } = await structured(
    fileListSchema,
    `You are the coding agent of a software factory. The workspace is a copy of existing software already branded for the client. Implement what the client requirement asks that the code does not yet do. Return at most 4 files with their COMPLETE new contents (existing paths to modify, or new paths). Keep each under 250 lines. "reason" is one sentence.`,
    `CLIENT REQUIREMENT:\n${requirement}\n\nWORKSPACE FILES:\n${digest(files)}`,
  );
  const upd = out.files.slice(0, 4);
  await saveStage(
    projectId,
    merge(files, upd),
    "developed",
    "workflow.develop",
    { summary: out.summary, files: codeDiff(files, upd) },
    upd.map((f) => ({ path: f.path, replacements: 1 })),
  );
  return { summary: out.summary, files: upd.map((f) => ({ path: f.path, reason: f.reason })) };
}

export async function testWorkspace(projectId: string) {
  const { files, requirement } = await loadWs(projectId);
  const { out } = await structured(
    testSchema,
    `You are the QA agent. Review the workspace code against the client requirement. List concrete bugs, broken imports, security problems and missing required features (max 10). "passed" is true only if there are no high or medium issues.`,
    `CLIENT REQUIREMENT:\n${requirement}\n\nWORKSPACE FILES:\n${digest(files)}`,
  );
  await saveStage(projectId, files, out.passed ? "tested" : "test_failed", "workflow.test", {
    ...out,
    kind: "ai_code_review",
    execution: "UNVERIFIED",
    workspace_hash: createHash("sha256").update(JSON.stringify(files)).digest("hex"),
  });
  return out;
}

export async function fixWorkspace(projectId: string) {
  const { db, files, requirement } = await loadWs(projectId);
  const { data: last } = await db
    .from("dev_audit_logs")
    .select("details")
    .eq("project_id", projectId)
    .eq("action", "workflow.test")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const report = last?.details as unknown as TestReport | undefined;
  if (!report) throw new Error("Run testing first.");
  if (!report.issues.length) return { summary: "No issues to fix.", files: [] };
  const { out } = await structured(
    fileListSchema,
    `You are the bug-fixing agent. Fix the listed QA issues. Return at most 4 files with COMPLETE corrected contents. "reason" names the issue fixed.`,
    `CLIENT REQUIREMENT:\n${requirement}\n\nQA ISSUES:\n${report.issues.map((i) => `[${i.severity}] ${i.path}: ${i.problem}`).join("\n")}\n\nWORKSPACE FILES:\n${digest(files)}`,
  );
  const upd = out.files.slice(0, 4);
  await saveStage(
    projectId,
    merge(files, upd),
    "fixed",
    "workflow.fix",
    { summary: out.summary, files: codeDiff(files, upd) },
    upd.map((f) => ({ path: f.path, replacements: 1 })),
  );
  return { summary: out.summary, files: upd.map((f) => ({ path: f.path, reason: f.reason })) };
}

export async function deliverProject(projectId: string, license: string) {
  const { db, files } = await loadWs(projectId);
  const { data: last } = await db
    .from("dev_audit_logs")
    .select("details")
    .eq("project_id", projectId)
    .eq("action", "workflow.test")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const report = last?.details as (TestReport & { workspace_hash?: string }) | undefined;
  if (!report?.passed)
    throw new Error(
      "Release gate: the latest test has not passed. Fix bugs and test again before delivery.",
    );
  if (report.workspace_hash !== createHash("sha256").update(JSON.stringify(files)).digest("hex"))
    throw new Error(
      "Workspace changed after review. Review the current source before creating a delivery snapshot.",
    );
  const v = await createVersion({
    projectId,
    change_history: "Delivered after AI development, QA and bug fixing.",
    test_status: "ai_review_only",
    delivery_status: "delivered",
    license_info: { type: license },
    build_info: { created_via: "workflow", files: files.length },
  });
  await db
    .from("dev_projects")
    .update({ status: "delivered", updated_at: new Date().toISOString() })
    .eq("id", projectId);
  await db
    .from("dev_issues")
    .update({ status: "fixed", fixed_version_id: v.id, updated_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("status", "open");
  await audit(
    "workflow.deliver",
    { version_code: v.version_code, release_id: v.release_id },
    projectId,
  );
  return { version_code: v.version_code, release_id: v.release_id, files };
}

// ---------- After delivery: deployment, client issues, recovery, upgrades ----------
export async function deployProject(projectId: string, target: string, url: string | null) {
  const db = await admin();
  await db
    .from("dev_projects")
    .update({ status: "deployed", updated_at: new Date().toISOString() })
    .eq("id", projectId);
  await audit(
    "workflow.deploy",
    { target, url, summary: `Deployment recorded on ${target}${url ? ` at ${url}` : ""}.` },
    projectId,
  );
  return { ok: true };
}
export async function reportIssue(projectId: string, kind: "issue" | "upgrade", text: string) {
  const db = await admin();
  await db
    .from("dev_projects")
    .update({
      status: kind === "issue" ? "issue_reported" : "upgrade_requested",
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
  const { data: ver } = await db
    .from("dev_versions")
    .select("id, version_code")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: iss, error } = await db
    .from("dev_issues")
    .insert({ project_id: projectId, version_id: ver?.id ?? null, kind, text })
    .select("issue_code")
    .single();
  if (error || !iss) throw new Error("Could not create issue record.");
  await audit(
    kind === "issue" ? "workflow.issue" : "workflow.upgrade_request",
    { summary: text, issue_code: iss.issue_code, version_code: ver?.version_code ?? null },
    projectId,
  );
  return { ok: true, issue_code: iss.issue_code };
}
async function lastText(projectId: string, action: string) {
  const db = await admin();
  const { data } = await db
    .from("dev_audit_logs")
    .select("details")
    .eq("project_id", projectId)
    .eq("action", action)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const t = (data?.details as { summary?: string } | undefined)?.summary;
  if (!t) throw new Error("Nothing reported yet.");
  return t;
}
async function aiChange(projectId: string, role: string, ask: string) {
  const { files, requirement } = await loadWs(projectId);
  const { out } = await structured(
    fileListSchema,
    `${role} Return at most 4 files with COMPLETE new contents. "reason" is one sentence.`,
    `CLIENT REQUIREMENT:\n${requirement}\n\nREQUEST:\n${ask}\n\nWORKSPACE FILES:\n${digest(files)}`,
  );
  const upd = out.files.slice(0, 4);
  return {
    next: merge(files, upd),
    summary: out.summary,
    files: codeDiff(files, upd),
    changes: upd.map((f) => ({ path: f.path, replacements: 1 })),
  };
}
export async function recoverIssue(projectId: string) {
  const issue = await lastText(projectId, "workflow.issue");
  const r = await aiChange(
    projectId,
    "You are the recovery agent. Fix the client's reported issue in the delivered software.",
    issue,
  );
  await saveStage(
    projectId,
    r.next,
    "recovered",
    "workflow.recover",
    { summary: r.summary, files: r.files },
    r.changes,
  );
  return r.files.map((f) => ({ path: f.path, reason: f.reason }));
}
export async function buildUpgrade(projectId: string, license: string) {
  const ask = await lastText(projectId, "workflow.upgrade_request");
  const r = await aiChange(
    projectId,
    "You are the upgrade agent. Implement the client's upgrade request.",
    ask,
  );
  await saveStage(
    projectId,
    r.next,
    "upgraded",
    "workflow.upgrade",
    { summary: r.summary, files: r.files },
    r.changes,
  );
  const report = await testWorkspace(projectId);
  if (!report.passed) return { version_code: null, test_failed: true };
  const v = await createVersion({
    projectId,
    change_history: `Upgrade: ${ask}`,
    test_status: "ai_review_only",
    delivery_status: "delivered",
    license_info: { type: license },
    build_info: { created_via: "upgrade" },
  });
  const db2 = await admin();
  await db2
    .from("dev_projects")
    .update({ status: "upgraded", updated_at: new Date().toISOString() })
    .eq("id", projectId);
  await db2
    .from("dev_issues")
    .update({ status: "fixed", fixed_version_id: v.id, updated_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("status", "open");
  await audit(
    "workflow.new_version",
    { version_code: v.version_code, release_id: v.release_id },
    projectId,
  );
  return { version_code: v.version_code };
}

// ---------- Find everything by PROJECT-ID ----------
export async function findByProjectCode(code: string) {
  const db = await admin();
  const { data: p } = await db
    .from("dev_projects")
    .select("id")
    .ilike("project_code", code.trim())
    .maybeSingle();
  if (!p) throw new Error("No project with this Project ID.");
  const [detail, issues] = await Promise.all([
    projectDetail(p.id),
    db
      .from("dev_issues")
      .select("*")
      .eq("project_id", p.id)
      .order("created_at", { ascending: false }),
  ]);
  return { ...detail, issues: issues.data ?? [] };
}
