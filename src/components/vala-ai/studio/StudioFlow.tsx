import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  devDeployFn,
  devFindProjectFn,
  devRecoverFn,
  devReportFn,
  devUpgradeFn,
  devBrandWorkspaceFn,
  devDashboardFn,
  devDeliverFn,
  devDevelopFn,
  devFixFn,
  devProjectFn,
  devTestFn,
} from "@/lib/vala-ai/studio/developer/developer.functions";

const STEPS = [
  "Client requirement received",
  "Project ID created",
  "Requirement saved",
  "AI requirement analysis",
  "Library search",
  "Matching with evidence",
  "Candidate review",
  "Source software selected",
  "Approval to start",
  "Isolated workspace created",
  "Software copied in",
  "Branding applied",
  "Customization plan",
  "AI development started",
  "AI development done",
  "Code generated (execution not verified)",
  "AI code review started",
  "AI review report",
  "Bug list",
  "Bug fixing",
  "Fixes reviewed",
  "AI review accepted",
  "Version created",
  "License assigned",
  "Delivered to client",
  "Optional deployment",
  "Client issue reported",
  "Recovery / fix",
  "Upgrade request",
  "New version",
];
// project.status → index (0-based) of the last completed step
const DONE_AT: Record<string, number> = {
  intake: 2,
  analyzed: 3,
  source_selected: 8,
  workspace_ready: 10,
  branded: 11,
  developed: 14,
  test_failed: 17,
  tested: 21,
  fixed: 19,
  delivered: 24,
  deployed: 25,
  issue_reported: 26,
  recovered: 27,
  upgrade_requested: 28,
  upgraded: 29,
};
const label = (s: string) => s.replace(/_/g, " ");
// audit action → 0-based step indexes it completes
const ACTION_STEPS: Record<string, number[]> = {
  "project.create": [0, 1, 2],
  "requirement.analyze": [3],
  "library.match": [4, 5, 6],
  "project.select_source": [7, 8],
  "workspace.create": [9, 10],
  "workspace.brand": [11, 12],
  "workflow.develop": [13, 14, 15],
  "workflow.test": [16, 17, 18],
  "workflow.fix": [19, 20],
  "version.create": [22, 23],
  "workflow.deliver": [21, 24],
  "workflow.deploy": [25],
  "workflow.issue": [26],
  "workflow.recover": [27],
  "workflow.upgrade_request": [28],
  "workflow.new_version": [29],
};

type Client = {
  id: string;
  external_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
};
type Project = {
  id: string;
  name: string;
  project_code: string;
  status: string;
  client_name: string | null;
  branding: unknown;
  dev_clients?: Client | null;
};
type CodeFile = { path: string; reason: string; before?: string; after?: string; isNew?: boolean };
type Log = { id: string; action: string; created_at: string; details: unknown };

export function StudioFlow() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [brand, setBrand] = useState({
    name: "",
    primary: "#8b5cf6",
    secondary: "#22c5dc",
    tagline: "",
  });
  const [license, setLicense] = useState("Single client license");
  const [deploy, setDeploy] = useState({ target: "Client server", url: "" });
  const [issue, setIssue] = useState("");
  const [upgrade, setUpgrade] = useState("");
  const [code, setCode] = useState("");
  type Found = {
    project: Project;
    versions: {
      id: string;
      version_code: string;
      release_id: string | null;
      test_status: string;
      created_at: string;
    }[];
    issues: { id: string; issue_code: string; kind: string; status: string; text: string }[];
  };
  const [found, setFound] = useState<Found | null>(null);
  const lookup = async () => {
    setErr(null);
    try {
      const r = (await devFindProjectFn({ data: { code } })) as unknown as Found;
      setFound(r);
      setSel(r.project.id);
    } catch (e) {
      setFound(null);
      setErr(e instanceof Error ? e.message : "Not found.");
    }
  };

  const refresh = async () => {
    const d = await devDashboardFn();
    setProjects(d.projects as Project[]);
    const id = sel ?? d.projects[0]?.id ?? null;
    setSel(id);
    if (id) setLogs((await devProjectFn({ data: { id } })).logs as Log[]);
  };
  useEffect(() => {
    void refresh().catch((e: unknown) =>
      setErr(e instanceof Error ? e.message : "Flow could not load."),
    );
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = projects.find((x) => x.id === sel);
  const run = async (k: string, fn: () => Promise<unknown>) => {
    setBusy(k);
    setErr(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Step failed.");
    } finally {
      setBusy(null);
    }
  };
  const doneIdx = p ? (DONE_AT[p.status] ?? 0) : -1;
  const failed = p?.status === "test_failed";
  const can = (s: string[]) => !!p && s.includes(p.status) && !busy;

  const actions: { k: string; title: string; ok: string[]; go: () => Promise<unknown> }[] = p
    ? [
        {
          k: "brand",
          title: "1 · Apply branding",
          ok: ["workspace_ready", "branded"],
          go: () =>
            devBrandWorkspaceFn({
              data: {
                projectId: p.id,
                name: brand.name || p.name,
                primary: brand.primary,
                secondary: brand.secondary,
                tagline: brand.tagline || null,
              },
            }),
        },
        {
          k: "dev",
          title: "2 · AI development",
          ok: ["branded", "developed"],
          go: () => devDevelopFn({ data: { projectId: p.id } }),
        },
        {
          k: "test",
          title: "3 · AI code review",
          ok: ["developed", "fixed", "test_failed"],
          go: () => devTestFn({ data: { projectId: p.id } }),
        },
        {
          k: "fix",
          title: "4 · Fix bugs",
          ok: ["test_failed"],
          go: () => devFixFn({ data: { projectId: p.id } }),
        },
        {
          k: "deliver",
          title: "5 · Deliver version",
          ok: ["tested"],
          go: () => devDeliverFn({ data: { projectId: p.id, license } }),
        },
      ]
    : [];
  const after = ["delivered", "deployed", "recovered", "upgraded"];
  const later: { k: string; title: string; ok: string[]; go: () => Promise<unknown> }[] = p
    ? [
        {
          k: "deploy",
          title: "6 · Record deployment",
          ok: after,
          go: () =>
            devDeployFn({
              data: { projectId: p.id, target: deploy.target, url: deploy.url || null },
            }),
        },
        {
          k: "issue",
          title: "7 · Report client issue",
          ok: after,
          go: () =>
            devReportFn({ data: { projectId: p.id, kind: "issue", text: issue } }).then(() =>
              setIssue(""),
            ),
        },
        {
          k: "recover",
          title: "8 · AI recovery fix",
          ok: ["issue_reported"],
          go: () => devRecoverFn({ data: { projectId: p.id } }),
        },
        {
          k: "upreq",
          title: "9 · Request upgrade",
          ok: after,
          go: () =>
            devReportFn({ data: { projectId: p.id, kind: "upgrade", text: upgrade } }).then(() =>
              setUpgrade(""),
            ),
        },
        {
          k: "upgrade",
          title: "10 · Build new version",
          ok: ["upgrade_requested"],
          go: () => devUpgradeFn({ data: { projectId: p.id, license } }),
        },
      ]
    : [];

  const [auto, setAuto] = useState<string | null>(null);
  const autoRun = async () => {
    if (!p || busy) return;
    const id = p.id;
    setErr(null);
    setBusy("auto");
    const status = async () =>
      ((await devDashboardFn()).projects as Project[]).find((x) => x.id === id)?.status ?? "";
    const step = async (name: string, fn: () => Promise<unknown>) => {
      setAuto(name);
      await fn();
      await refresh();
    };
    try {
      let st = await status();
      let tries = 0,
        issueDone = false,
        upDone = false;
      for (let guard = 0; guard < 20; guard++) {
        if (st === "workspace_ready")
          await step("Branding", () =>
            devBrandWorkspaceFn({
              data: {
                projectId: id,
                name: brand.name || p.name,
                primary: brand.primary,
                secondary: brand.secondary,
                tagline: brand.tagline || null,
              },
            }),
          );
        else if (st === "branded")
          await step("AI development", () => devDevelopFn({ data: { projectId: id } }));
        else if (st === "developed" || st === "fixed")
          await step("Testing", () => devTestFn({ data: { projectId: id } }));
        else if (st === "test_failed") {
          if (tries++ >= 2) {
            setAuto("Stopped: tests still failing after 2 fixes — release gate blocks delivery");
            break;
          } else await step("Bug fixing", () => devFixFn({ data: { projectId: id } }));
        } else if (st === "tested")
          await step("Delivery", () => devDeliverFn({ data: { projectId: id, license } }));
        else if (st === "delivered")
          await step("Deployment", () =>
            devDeployFn({
              data: {
                projectId: id,
                target: deploy.target || "Client server",
                url: deploy.url || null,
              },
            }),
          );
        else if (st === "deployed" && issue.trim().length >= 3 && !issueDone) {
          issueDone = true;
          await step("Client issue", () =>
            devReportFn({ data: { projectId: id, kind: "issue", text: issue } }),
          );
        } else if (st === "issue_reported")
          await step("Recovery", () => devRecoverFn({ data: { projectId: id } }));
        else if (["deployed", "recovered"].includes(st) && !upDone) {
          upDone = true;
          const text =
            upgrade.trim() || "Polish the software: improve UX, fix small issues and performance.";
          await step("Upgrade request", () =>
            devReportFn({ data: { projectId: id, kind: "upgrade", text } }),
          );
        } else if (st === "upgrade_requested")
          await step("New version", () => devUpgradeFn({ data: { projectId: id, license } }));
        else break;
        st = await status();
      }
      setAuto(
        st === "upgraded"
          ? "Done · all 30 steps complete, new version created"
          : `Stopped at: ${label(st)}`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Auto run failed.");
    } finally {
      setBusy(null);
    }
  };
  const stepTime: Record<number, string> = {};
  for (const l of [...logs].reverse())
    for (const i of ACTION_STEPS[l.action] ?? []) stepTime[i] = l.created_at;
  const wf = logs.filter((l) => l.action.startsWith("workflow.") || l.action === "workspace.brand");

  return (
    <div className="min-h-screen bg-background font-studio-body text-sm text-foreground">
      <header className="flex h-12 items-center gap-3 border-b border-studio-line bg-studio-panel px-5">
        <Link to="/vala-ai" className="font-studio-display text-[15px] uppercase tracking-tight">
          Vala AI
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-[.2em] text-studio-faint">
          Project flow · 30 steps
        </span>
      </header>
      <div className="grid gap-5 p-5 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-1.5">
          <h2 className="font-mono text-[10px] uppercase tracking-[.2em] text-studio-faint">
            Find by Project ID
          </h2>
          <div className="flex gap-1.5">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder="SV-PROJECT-XXXXXXXX"
              className="min-w-0 flex-1 rounded-md border border-studio-line bg-studio-panel px-2 py-1.5 font-mono text-[12px]"
            />
            <button
              onClick={lookup}
              className="rounded-md bg-accent px-3 text-[12px] text-accent-foreground"
            >
              Find
            </button>
          </div>
          {found && (
            <div className="space-y-1 rounded-md border border-studio-line bg-studio-panel p-3 text-[12px]">
              <div className="font-medium">
                {found.project.name} · {label(found.project.status)}
              </div>
              <div className="font-mono text-[10px] uppercase text-studio-faint">Versions</div>
              {!found.versions.length && <div className="text-studio-dim">No versions yet.</div>}
              {found.versions.map((v) => (
                <div key={v.id} className="font-mono text-[11px]">
                  {v.version_code} · {v.release_id ?? "—"} · {v.test_status}
                </div>
              ))}
              <div className="pt-1 font-mono text-[10px] uppercase text-studio-faint">
                Issues / upgrades
              </div>
              {!found.issues.length && <div className="text-studio-dim">None.</div>}
              {found.issues.map((i) => (
                <div key={i.id} className="text-[11px]">
                  <span className="font-mono">{i.issue_code}</span> · {i.kind} ·{" "}
                  <span className={i.status === "fixed" ? "text-studio-ok" : "text-studio-fail"}>
                    {i.status}
                  </span>{" "}
                  — {i.text.slice(0, 60)}
                </div>
              ))}
            </div>
          )}
          <h2 className="pt-3 font-mono text-[10px] uppercase tracking-[.2em] text-studio-faint">
            Projects
          </h2>
          {!projects.length && (
            <p className="text-studio-dim">No projects yet. Create one on the Developer page.</p>
          )}
          {projects.map((x) => {
            const d = (DONE_AT[x.status] ?? 0) + 1;
            return (
              <button
                key={x.id}
                onClick={() => setSel(x.id)}
                className={`w-full rounded-md border p-3 text-left ${x.id === sel ? "border-accent bg-accent/10" : "border-studio-line bg-studio-panel hover:bg-studio-raise"}`}
              >
                <div className="flex justify-between">
                  <span className="font-medium">{x.name}</span>
                  <span className="font-mono text-[10px] text-studio-faint">{x.project_code}</span>
                </div>
                <div className="mt-1 text-[12px] text-studio-dim">
                  {x.dev_clients?.name || x.client_name
                    ? `${x.dev_clients?.name || x.client_name} · `
                    : ""}
                  Step {Math.min(d + 1, 30)}/30 · {STEPS[Math.min(d, 29)]}
                </div>
                <div className="mt-2 h-1 rounded bg-studio-raise">
                  <div
                    className={`h-full rounded ${x.status === "test_failed" ? "bg-studio-fail" : "bg-accent"}`}
                    style={{ width: `${(d / 30) * 100}%` }}
                  />
                </div>
                <div
                  className={`mt-1 font-mono text-[10px] ${x.status === "test_failed" ? "text-studio-fail" : x.status === "delivered" ? "text-studio-ok" : "text-studio-faint"}`}
                >
                  {label(x.status)}
                </div>
              </button>
            );
          })}
        </aside>

        {p && (
          <main className="space-y-5">
            <section className="rounded-lg border border-studio-line bg-studio-panel p-4">
              <h2 className="font-studio-display text-[16px] uppercase tracking-tight">
                {p.name} · <span className="text-studio-dim">{label(p.status)}</span>
              </h2>
              <p className="mt-1 text-[12px] text-studio-dim">
                Client: {p.dev_clients?.name || p.client_name || "—"}
                {p.dev_clients
                  ? ` (${p.dev_clients.source === "control_panel" ? "Control Panel" : "local"} record${p.dev_clients.email ? ` · ${p.dev_clients.email}` : ""} · ${projects.filter((x) => x.dev_clients?.id === p.dev_clients!.id).length} project(s))`
                  : ""}{" "}
                · {p.project_code} · Step {Math.min(doneIdx + 2, 30)} of 30 ·{" "}
                {Math.round(((doneIdx + 1) / 30) * 100)}% done
              </p>
              <ol className="mt-3 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {STEPS.map((s, i) => {
                  const st =
                    i <= doneIdx
                      ? "done"
                      : i === doneIdx + 1
                        ? failed
                          ? "failed"
                          : "current"
                        : "pending";
                  return (
                    <li
                      key={s}
                      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${st === "current" ? "border-accent bg-accent/10" : st === "failed" ? "border-studio-fail bg-studio-fail/10" : "border-studio-line"}`}
                    >
                      <span
                        className={`grid size-5 shrink-0 place-items-center rounded-full font-mono text-[10px] ${st === "done" ? "bg-studio-ok/15 text-studio-ok" : st === "failed" ? "bg-studio-fail/20 text-studio-fail" : st === "current" ? "bg-accent/20 text-accent" : "border border-studio-line text-studio-faint"}`}
                      >
                        {st === "done" ? <Check className="size-3" /> : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className={st === "pending" ? "text-studio-dim" : ""}>{s}</span>
                        {stepTime[i] && (
                          <span className="block font-mono text-[9px] text-studio-faint">
                            {new Date(stepTime[i]!).toLocaleString([], {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </span>
                      <span className="ml-auto font-mono text-[9px] uppercase text-studio-faint">
                        {st}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="rounded-lg border border-studio-line bg-studio-panel p-4">
              <h2 className="font-studio-display text-[14px] uppercase tracking-tight">
                Workflow after setup
              </h2>
              <p className="mt-1 text-[12px] text-studio-dim">
                Needs a workspace from the Developer page. Each step runs for real on this project's
                copy.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <input
                  aria-label="Brand name"
                  placeholder={`Brand name (${p.name})`}
                  value={brand.name}
                  onChange={(e) => setBrand({ ...brand, name: e.target.value })}
                  className="h-9 rounded-md border border-studio-line bg-background px-3"
                />
                <input
                  aria-label="Tagline"
                  placeholder="Tagline"
                  value={brand.tagline}
                  onChange={(e) => setBrand({ ...brand, tagline: e.target.value })}
                  className="h-9 rounded-md border border-studio-line bg-background px-3"
                />
                <label className="flex items-center gap-2 text-studio-dim">
                  Primary{" "}
                  <input
                    type="color"
                    value={brand.primary}
                    onChange={(e) => setBrand({ ...brand, primary: e.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2 text-studio-dim">
                  Secondary{" "}
                  <input
                    type="color"
                    value={brand.secondary}
                    onChange={(e) => setBrand({ ...brand, secondary: e.target.value })}
                  />
                </label>
                <input
                  aria-label="License"
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  className="h-9 rounded-md border border-studio-line bg-background px-3 sm:col-span-2"
                />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  disabled={
                    !p || !!busy || ["intake", "analyzed", "source_selected"].includes(p.status)
                  }
                  onClick={() => void autoRun()}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-5 font-semibold text-primary-foreground disabled:opacity-40"
                >
                  {busy === "auto" && <Loader2 className="size-4 animate-spin" />}Run all steps
                  automatically
                </button>
                {auto && (
                  <span className="text-[12px] text-studio-dim">
                    {busy === "auto" ? `Running: ${auto}…` : auto}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {actions.map((a) => (
                  <button
                    key={a.k}
                    disabled={!can(a.ok)}
                    onClick={() => run(a.k, a.go)}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 font-medium text-primary-foreground disabled:opacity-40"
                  >
                    {busy === a.k && <Loader2 className="size-4 animate-spin" />}
                    {a.title}
                  </button>
                ))}
              </div>
              <h3 className="mt-5 font-studio-display text-[13px] uppercase tracking-tight">
                After delivery
              </h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input
                  aria-label="Deployment target"
                  placeholder="Deploy target (e.g. Client server)"
                  value={deploy.target}
                  onChange={(e) => setDeploy({ ...deploy, target: e.target.value })}
                  className="h-9 rounded-md border border-studio-line bg-background px-3"
                />
                <input
                  aria-label="Live URL"
                  placeholder="Live URL (optional, https://…)"
                  value={deploy.url}
                  onChange={(e) => setDeploy({ ...deploy, url: e.target.value })}
                  className="h-9 rounded-md border border-studio-line bg-background px-3"
                />
                <textarea
                  aria-label="Client issue"
                  placeholder="Client ne kya problem batayi?"
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  className="min-h-16 rounded-md border border-studio-line bg-background p-3"
                />
                <textarea
                  aria-label="Upgrade request"
                  placeholder="Client kya naya chahta hai?"
                  value={upgrade}
                  onChange={(e) => setUpgrade(e.target.value)}
                  className="min-h-16 rounded-md border border-studio-line bg-background p-3"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {later.map((a) => (
                  <button
                    key={a.k}
                    disabled={
                      !can(a.ok) ||
                      (a.k === "issue" && issue.trim().length < 3) ||
                      (a.k === "upreq" && upgrade.trim().length < 3)
                    }
                    onClick={() => run(a.k, a.go)}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-accent px-4 font-medium text-accent disabled:opacity-40"
                  >
                    {busy === a.k && <Loader2 className="size-4 animate-spin" />}
                    {a.title}
                  </button>
                ))}
              </div>
              {err && <p className="mt-3 text-studio-fail">{err}</p>}
              <ul className="mt-4 space-y-2">
                {wf.map((l) => {
                  const d = l.details as {
                    summary?: string;
                    passed?: boolean;
                    issues?: { severity: string; path: string; problem: string }[];
                    files?: CodeFile[];
                    version_code?: string;
                    name?: string;
                    url?: string | null;
                  };
                  return (
                    <li key={l.id} className="rounded-md border border-studio-line p-3">
                      <div className="flex justify-between font-mono text-[11px]">
                        <span className="text-accent">{l.action}</span>
                        <span className="text-studio-faint">
                          {new Date(l.created_at).toLocaleString()}
                        </span>
                      </div>
                      {d.summary && <p className="mt-1">{d.summary}</p>}
                      {d.passed !== undefined && (
                        <p className={d.passed ? "text-studio-ok" : "text-studio-fail"}>
                          {d.passed ? "AI review passed (not executed)" : "Tests failed"}
                        </p>
                      )}
                      {d.issues?.map((i, k) => (
                        <p key={k} className="text-[12px] text-studio-dim">
                          [{i.severity}] {i.path}: {i.problem}
                        </p>
                      ))}
                      {d.files?.map((f) => (
                        <CodeView key={f.path} f={f} />
                      ))}
                      {d.version_code && (
                        <p className="text-studio-ok">Delivered {d.version_code}</p>
                      )}
                      {d.name && <p className="text-studio-dim">Branded as {d.name}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}

function CodeView({ f }: { f: CodeFile }) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"after" | "before">("after");
  const has = f.after !== undefined;
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        disabled={!has}
        className="text-left font-mono text-[11px] text-studio-dim hover:text-foreground disabled:hover:text-studio-dim"
      >
        {has ? (open ? "▾ " : "▸ ") : ""}
        {f.path}
        {f.isNew ? " (new)" : ""} — {f.reason}
      </button>
      {open && has && (
        <div className="mt-1 rounded-md border border-studio-line bg-background">
          <div className="flex gap-1 border-b border-studio-line p-1 text-[11px]">
            {(["after", "before"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setSide(k)}
                className={`rounded px-2 py-0.5 ${side === k ? "bg-accent text-primary-foreground" : "text-studio-dim"}`}
              >
                {k === "after" ? "New code" : "Old code"}
              </button>
            ))}
          </div>
          <pre className="max-h-96 overflow-auto p-3 font-mono text-[11px] leading-relaxed">
            {(side === "after" ? f.after : f.before) || "(empty — file did not exist)"}
          </pre>
        </div>
      )}
    </div>
  );
}
