import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Database,
  FileUp,
  FolderKanban,
  FolderSearch,
  HardDrive,
  Loader2,
  Palette,
  Plus,
  ScrollText,
  Search,
} from "lucide-react";
import {
  canPickFolders,
  pickFolder,
  readWorkspaceFiles,
  scanFolder,
  type ScannedItem,
} from "@/lib/vala-ai/studio/developer/ssd-scan";
import {
  devAnalyzeFn,
  devAnswerFn,
  devBrandWorkspaceFn,
  devCreateProjectFn,
  devCreateWorkspaceFn,
  devWorkspaceFn,
  devCreateVersionFn,
  devDashboardFn,
  devImportLibraryFn,
  devMatchFn,
  devProjectFn,
  devSelectSourceFn,
} from "@/lib/vala-ai/studio/developer/developer.functions";

type Dash = Awaited<ReturnType<typeof devDashboardFn>>;
type Detail = Awaited<ReturnType<typeof devProjectFn>>;
type Tab = "dashboard" | "intake" | "library" | "project";

const box = "rounded-lg border border-studio-line bg-studio-panel p-4";
const h = "mb-3 font-mono text-[10px] uppercase tracking-[.2em] text-studio-faint";
const btn =
  "inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[13px] font-medium text-primary-foreground disabled:opacity-50";
const btn2 =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-studio-line px-3 text-[13px] hover:bg-studio-raise disabled:opacity-50";
const input =
  "w-full rounded-md border border-studio-line bg-background px-3 py-2 text-sm outline-none focus:border-accent";
const when = (s: string) =>
  new Date(s).toLocaleString([], { dateStyle: "short", timeStyle: "short" });

export function DeveloperPanel() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dash, setDash] = useState<Dash | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDash(await devDashboardFn());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = (id: string) => {
    setProjectId(id);
    setTab("project");
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-[1180px] space-y-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">
            AI Developer · core system
          </div>
          <h1 className="mt-1 font-studio-display text-[30px] uppercase leading-none tracking-tight">
            Developer control panel
          </h1>
        </div>
        <div className="flex gap-2">
          {(
            [
              ["dashboard", "Dashboard", FolderKanban],
              ["intake", "New project", Plus],
              ["library", "Software library", Database],
            ] as const
          ).map(([k, l, I]) => (
            <button key={k} onClick={() => setTab(k)} className={tab === k ? btn : btn2}>
              <I className="size-3.5" />
              {l}
            </button>
          ))}
          {projectId && (
            <button onClick={() => setTab("project")} className={tab === "project" ? btn : btn2}>
              <ScrollText className="size-3.5" />
              Project
            </button>
          )}
        </div>
        {err && (
          <p className="rounded-md border border-studio-fail/40 p-2 text-sm text-studio-fail">
            {err}
          </p>
        )}
        {tab === "dashboard" && <DashboardView dash={dash} onOpen={open} />}
        {tab === "intake" && (
          <IntakeView
            onCreated={(id) => {
              void refresh();
              open(id);
            }}
          />
        )}
        {tab === "library" && <LibraryView size={dash?.librarySize ?? 0} onImported={refresh} />}
        {tab === "project" && projectId && <ProjectView id={projectId} />}
      </div>
    </div>
  );
}

function DashboardView({ dash, onOpen }: { dash: Dash | null; onOpen: (id: string) => void }) {
  if (!dash)
    return (
      <p className="text-studio-dim">
        <Loader2 className="inline size-4 animate-spin" /> Loading…
      </p>
    );
  const stats = [
    ["Library items", dash.librarySize],
    ["Projects", dash.projects.length],
    ["Versions", dash.versions.length],
    ["Audit events", dash.logs.length],
  ] as const;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {stats.map(([l, v]) => (
          <div key={l} className={box}>
            <div className={h}>{l}</div>
            <div className="font-studio-display text-[28px] leading-none">{v}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <section className={`${box} col-span-2`}>
          <h2 className={h}>Projects</h2>
          {dash.projects.length === 0 && (
            <p className="text-[13px] text-studio-dim">
              Abhi koi project nahi. "New project" se pehla project banayein.
            </p>
          )}
          <div className="divide-y divide-line">
            {dash.projects.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpen(p.id)}
                className="flex w-full items-center gap-3 py-2 text-left hover:bg-studio-raise"
              >
                <span className="w-28 font-mono text-[12px] text-accent">{p.project_code}</span>
                <span className="flex-1 text-[13px]">{p.name}</span>
                <span className="font-mono text-[11px] text-studio-dim">{p.status}</span>
                <span className="w-28 text-right font-mono text-[10px] text-studio-faint">
                  {when(p.created_at)}
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className={box}>
          <h2 className={h}>Audit log</h2>
          <AuditList logs={dash.logs} />
        </section>
      </div>
    </div>
  );
}

function AuditList({ logs }: { logs: { id: string; action: string; created_at: string }[] }) {
  if (!logs.length) return <p className="text-[12px] text-studio-dim">No events yet.</p>;
  return (
    <ul className="space-y-1.5 font-mono text-[11px]">
      {logs.map((l) => (
        <li key={l.id}>
          <span className="text-studio-faint">{when(l.created_at)}</span> · {l.action}
        </li>
      ))}
    </ul>
  );
}

function IntakeView({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [req, setReq] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setErr(null);
    let createdProjectId: string | null = null;
    try {
      const r = await devCreateProjectFn({
        data: { name, client_name: client || null, requirement: req },
      });
      createdProjectId = r.projectId;
      await devAnalyzeFn({ data: { requirementId: r.requirementId } });
      onCreated(r.projectId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      if (createdProjectId) {
        toast.error(
          `Project saved, but analysis failed: ${e instanceof Error ? e.message : "Unknown error"}`,
        );
        onCreated(createdProjectId);
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={`${box} space-y-3`}>
      <h2 className={h}>Requirement intake</h2>
      <div className="grid grid-cols-2 gap-3">
        <input
          aria-label="Project name"
          className={input}
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          aria-label="Client name"
          className={input}
          placeholder="Client name (optional)"
          value={client}
          onChange={(e) => setClient(e.target.value)}
        />
      </div>
      <textarea
        aria-label="Client requirement"
        className={input}
        rows={5}
        placeholder="Client ki poori requirement likhein…"
        value={req}
        onChange={(e) => setReq(e.target.value)}
      />
      {err && <p className="text-sm text-studio-fail">{err}</p>}
      <button
        className={btn}
        disabled={busy || !name.trim() || req.trim().length < 5}
        onClick={submit}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        {busy ? "Creating + analyzing…" : "Create project & analyze"}
      </button>
    </section>
  );
}

const SAMPLE_FORMAT = `[
  {
    "source_key": "pos-retail-v3",
    "name": "Retail POS",
    "category": "point of sale",
    "modules": ["billing", "inventory"],
    "features": ["barcode", "gst invoice"],
    "technology": ["php", "jquery"],
    "database_engine": "mysql",
    "framework": "laravel",
    "capabilities": ["multi store"],
    "source_location": "SSD:/library/pos/retail-pos-v3",
    "version": "3.2",
    "compatibility": "PHP 8.1+",
    "known_requirements": "Needs printer driver",
    "metadata": {}
  }
]`;

function LibraryView({ size, onImported }: { size: number; onImported: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await devImportLibraryFn({ data: { json: await f.text() } });
      setMsg(`${r.imported} items imported · library now has ${r.total}`);
      onImported();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <SsdScanner onImported={onImported} />
      <section className={`${box} space-y-3`}>
        <h2 className={h}>Software library index · {size} items</h2>
        <p className="text-[13px] text-studio-dim">
          SSD ke software ki index file (JSON, ek baar mein 2,000 tak) upload karein. Sirf metadata
          aata hai, source code nahi. Same <span className="font-mono">source_key</span> dobara aaye
          to update hota hai.
        </p>
        <input
          ref={ref}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label="Library index file"
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button className={btn} disabled={busy} onClick={() => ref.current?.click()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileUp className="size-3.5" />}
          Upload index JSON
        </button>
        {msg && <p className="text-sm text-studio-ok">{msg}</p>}
        {err && <p className="text-sm text-studio-fail">{err}</p>}
        <details className="text-[12px] text-studio-dim">
          <summary className="cursor-pointer">Index file format</summary>
          <pre className="mt-2 overflow-auto rounded-md border border-studio-line bg-background p-3 font-mono text-[11px]">
            {SAMPLE_FORMAT}
          </pre>
        </details>
      </section>
    </div>
  );
}

function ProjectView({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [changes, setChanges] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const load = useCallback(async () => {
    setD(await devProjectFn({ data: { id } }));
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (k: string, f: () => Promise<unknown>) => {
    setBusy(k);
    setErr(null);
    try {
      await f();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };
  if (!d)
    return (
      <p className="text-studio-dim">
        <Loader2 className="inline size-4 animate-spin" /> Loading…
      </p>
    );
  const req = d.requirements[0];
  const a = req?.analysis as null | {
    summary: string;
    category: string;
    modules: string[];
    features: string[];
    technology: string[];
    database: string | null;
    branding: { name: string | null; colors: string[] };
    business_type?: string;
    optional_features?: string[];
    deployment?: string[];
    missing_info?: string[];
  };

  return (
    <div className="space-y-3">
      <section className={box}>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[14px] text-accent">{d.project.project_code}</span>
          <span className="font-studio-display text-[18px] uppercase">{d.project.name}</span>
          <span className="ml-auto font-mono text-[11px] text-studio-dim">{d.project.status}</span>
        </div>
        {req && <p className="mt-2 text-[13px] text-studio-dim">{req.raw_text}</p>}
      </section>
      {err && <p className="text-sm text-studio-fail">{err}</p>}

      <section className={box}>
        <h2 className={h}>Requirement analysis</h2>
        {a ? (
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <p className="col-span-2 text-[13px]">{a.summary}</p>
            {(
              [
                ["Business type", a.business_type ? [a.business_type] : []],
                ["Category", [a.category]],
                ["Modules", a.modules],
                ["Features", a.features],
                ["Technology", a.technology],
                ["Database", a.database ? [a.database] : []],
                ["Optional features", a.optional_features ?? []],
                ["Branding", [a.branding.name, ...a.branding.colors].filter(Boolean) as string[]],
                ["Deployment", a.deployment ?? []],
                ["Missing information", a.missing_info ?? []],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <span className="font-mono text-[10px] uppercase text-studio-faint">{k}</span>
                <div>{v.length ? v.join(", ") : "—"}</div>
              </div>
            ))}
          </div>
        ) : null}
        {a && (a.missing_info?.length ?? 0) > 0 && (
          <div className="mt-3 space-y-2 border-t border-studio-line pt-3">
            <div className="font-mono text-[10px] uppercase text-studio-faint">
              Answer missing information
            </div>
            {a.missing_info!.map((q, i) => (
              <label key={q} className="block text-[12px]">
                <span className="text-studio-dim">{q}</span>
                <input
                  aria-label={q}
                  className={input}
                  value={answers[i] ?? ""}
                  onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                />
              </label>
            ))}
            <button
              className={btn2}
              disabled={!!busy}
              onClick={() =>
                act("ans", () =>
                  devAnswerFn({
                    data: {
                      requirementId: req!.id,
                      answers: a.missing_info!.map((q, i) => ({ q, a: answers[i] ?? "" })),
                    },
                  }).then(() => setAnswers({})),
                )
              }
            >
              {busy === "ans" && <Loader2 className="size-3.5 animate-spin" />}Save answers &
              re-analyze
            </button>
          </div>
        )}
        {a && (
          <button
            className={`${btn2} mt-2`}
            disabled={!!busy}
            onClick={() => act("an", () => devAnalyzeFn({ data: { requirementId: req!.id } }))}
          >
            {busy === "an" && <Loader2 className="size-3.5 animate-spin" />}Re-run analysis
          </button>
        )}
        {!a && (
          <button
            className={btn2}
            disabled={!!busy}
            onClick={() => act("an", () => devAnalyzeFn({ data: { requirementId: req!.id } }))}
          >
            {busy === "an" && <Loader2 className="size-3.5 animate-spin" />}Analyze
          </button>
        )}
      </section>

      <section className={box}>
        <div className="flex items-center">
          <h2 className={h}>Software matching (with evidence)</h2>
          <button
            className={`${btn2} ml-auto`}
            disabled={!!busy || !a}
            onClick={() => act("m", () => devMatchFn({ data: { requirementId: req!.id } }))}
          >
            {busy === "m" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Search className="size-3.5" />
            )}
            Find matching software
          </button>
        </div>
        {d.matches.length === 0 && (
          <p className="text-[12px] text-studio-dim">
            Abhi koi match nahi. Library index upload karke "Find matching software" dabayein.
          </p>
        )}
        <div className="space-y-2">
          {d.matches.map((m) => {
            const li = m.library_items as {
              name: string;
              source_key: string;
              source_location: string;
            } | null;
            const ev = m.evidence as {
              field: string;
              matched: string[];
              missing: string[];
              weight: number;
            }[];
            const chosen = d.project.selected_item_id === m.item_id;
            return (
              <div
                key={m.id}
                className={`rounded-md border p-3 ${chosen ? "border-studio-ok" : "border-studio-line"} bg-background`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] text-accent">
                    {Number(m.score).toFixed(1)}%
                  </span>
                  <span className="text-[13px] font-medium">{li?.name}</span>
                  <span className="font-mono text-[10px] text-studio-faint">
                    {li?.source_location}
                  </span>
                  <button
                    className={`${chosen ? btn : btn2} ml-auto`}
                    disabled={!!busy || chosen}
                    onClick={() =>
                      act("s", () =>
                        devSelectSourceFn({ data: { projectId: id, itemId: m.item_id } }),
                      )
                    }
                  >
                    {chosen ? "Selected" : "Select source"}
                  </button>
                </div>
                <ul className="mt-2 space-y-0.5 font-mono text-[11px]">
                  {ev.map((e) => (
                    <li key={e.field}>
                      <span className="text-studio-faint">
                        {e.field} ×{e.weight}:
                      </span>{" "}
                      <span className="text-studio-ok">{e.matched.join(", ") || "—"}</span>
                      {e.missing.length > 0 && (
                        <span className="text-studio-fail"> · missing {e.missing.join(", ")}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {d.project.selected_item_id && <WorkspaceSection projectId={id} onChange={load} />}

      <section className={box}>
        <h2 className={h}>Versions (never overwritten)</h2>
        <div className="flex gap-2">
          <input
            aria-label="Version change history"
            className={input}
            placeholder="Is version mein kya badla?"
            value={changes}
            onChange={(e) => setChanges(e.target.value)}
          />
          <button
            className={btn}
            disabled={!!busy || !changes.trim()}
            onClick={() =>
              act("v", async () => {
                await devCreateVersionFn({
                  data: {
                    projectId: id,
                    change_history: changes,
                    test_status: "not_tested",
                    delivery_status: "not_delivered",
                    license_type: "unassigned",
                  },
                });
                setChanges("");
              })
            }
          >
            Create version
          </button>
        </div>
        <ul className="mt-3 space-y-1 font-mono text-[11px]">
          {d.versions.map((v) => (
            <li key={v.id}>
              <span className="text-accent">
                {d.project.project_code}/{v.version_code}
              </span>{" "}
              · {v.change_history} · test {v.test_status} · {v.delivery_status} · license{" "}
              {(v.license_info as { type?: string }).type ?? "—"} ·{" "}
              <span className="text-studio-faint">{when(v.created_at)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={box}>
        <h2 className={h}>Project history</h2>
        <AuditList logs={d.logs} />
      </section>
    </div>
  );
}

function SsdScanner({ onImported }: { onImported: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [items, setItems] = useState<ScannedItem[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const scan = async () => {
    setErr(null);
    setMsg(null);
    setItems(null);
    try {
      const root = await pickFolder();
      setBusy("Scanning…");
      const found = await scanFolder(root, (dirs, n) =>
        setBusy(`Scanning… ${dirs} folders · ${n} software found`),
      );
      setItems(found);
      if (!found.length)
        setMsg("Is folder mein koi software (package.json, composer.json, index.php…) nahi mila.");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setErr(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setBusy(null);
    }
  };
  const importAll = async () => {
    if (!items?.length) return;
    setBusy("Importing…");
    setErr(null);
    try {
      const r = await devImportLibraryFn({ data: { json: JSON.stringify(items) } });
      setMsg(`${r.imported} software imported · library now has ${r.total}`);
      setItems(null);
      onImported();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className={`${box} space-y-3`}>
      <h2 className={h}>
        <HardDrive className="mr-1 inline size-3.5" />
        SSD scanner
      </h2>
      <p className="text-[13px] text-studio-dim">
        SSD ka library folder chunein. Scanner aapke computer par hi har software ki manifest files
        (package.json, composer.json, README…) padhta hai aur sirf details import karta hai — source
        code upload nahi hota.
      </p>
      {canPickFolders() ? (
        <button className={btn} disabled={!!busy} onClick={scan}>
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FolderSearch className="size-3.5" />
          )}
          {busy ?? "Scan SSD folder"}
        </button>
      ) : (
        <p className="text-sm text-studio-fail">
          Folder scan ke liye Chrome ya Edge desktop browser use karein.
        </p>
      )}
      {items && items.length > 0 && (
        <div className="space-y-2">
          <div className="max-h-64 overflow-auto rounded-md border border-studio-line">
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="text-studio-faint">
                <tr>
                  <th className="p-2">Name</th>
                  <th>Framework</th>
                  <th>Tech</th>
                  <th>DB</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.source_key} className="border-t border-studio-line">
                    <td className="p-2 text-accent">{i.name}</td>
                    <td>{i.framework ?? "—"}</td>
                    <td>{i.technology.join(", ") || "—"}</td>
                    <td>{i.database_engine ?? "—"}</td>
                    <td className="text-studio-faint">{i.source_location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className={btn} disabled={!!busy} onClick={importAll}>
            Import {items.length} into library
          </button>
        </div>
      )}
      {msg && <p className="text-sm text-studio-ok">{msg}</p>}
      {err && <p className="text-sm text-studio-fail">{err}</p>}
    </section>
  );
}

type Ws = Awaited<ReturnType<typeof devWorkspaceFn>>;
function WorkspaceSection({ projectId, onChange }: { projectId: string; onChange: () => void }) {
  const [ws, setWs] = useState<Ws | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [b, setB] = useState({ name: "", primary: "#8b5cf6", secondary: "#22c5dc" });
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async () => {
    const w = await devWorkspaceFn({ data: { projectId } });
    setWs(w);
    if (w?.branding?.name)
      setB({
        name: w.branding.name,
        primary: w.branding.primary ?? "#8b5cf6",
        secondary: w.branding.secondary ?? "#22c5dc",
      });
  }, [projectId]);
  useEffect(() => {
    void load();
  }, [load]);
  const copyIn = async () => {
    setErr(null);
    try {
      const root = await pickFolder();
      setBusy("copy");
      const { files } = await readWorkspaceFiles(root);
      if (!files.length) throw new Error("Is folder mein koi text/code file nahi mili.");
      await devCreateWorkspaceFn({ data: { projectId, files } });
      await load();
      onChange();
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setErr(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setBusy(null);
    }
  };
  const brand = async () => {
    setBusy("brand");
    setErr(null);
    try {
      await devBrandWorkspaceFn({ data: { projectId, ...b } });
      await load();
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Branding failed");
    } finally {
      setBusy(null);
    }
  };
  const lib = ws?.library_items as { name: string; source_location: string } | null | undefined;
  const file = ws?.files.find((f) => f.path === open);
  return (
    <section className={`${box} space-y-3`}>
      <h2 className={h}>Isolated project workspace</h2>
      {ws === undefined ? (
        <Loader2 className="size-4 animate-spin" />
      ) : !ws ? (
        <>
          <p className="text-[13px] text-studio-dim">
            Selected software ka folder SSD se chunein — uski ek alag copy sirf is project ke
            workspace mein banegi. Original SSD files kabhi nahi badlti.
          </p>
          <button className={btn} disabled={!!busy || !canPickFolders()} onClick={copyIn}>
            {busy === "copy" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FolderSearch className="size-3.5" />
            )}
            Copy software into workspace
          </button>
        </>
      ) : (
        <>
          <p className="font-mono text-[11px] text-studio-dim">
            {ws.files.length} files · copy of {lib?.name} ({lib?.source_location}) · updated{" "}
            {when(ws.updated_at)}
          </p>
          <div className="grid grid-cols-[1fr_120px_120px_auto] items-end gap-2">
            <label className="text-[11px] text-studio-faint">
              Brand name
              <input
                aria-label="Brand name"
                className={input}
                value={b.name}
                onChange={(e) => setB({ ...b, name: e.target.value })}
              />
            </label>
            <label className="text-[11px] text-studio-faint">
              Primary
              <input
                aria-label="Primary color"
                type="color"
                className="h-9 w-full rounded-md border border-studio-line bg-background"
                value={b.primary}
                onChange={(e) => setB({ ...b, primary: e.target.value })}
              />
            </label>
            <label className="text-[11px] text-studio-faint">
              Secondary
              <input
                aria-label="Secondary color"
                type="color"
                className="h-9 w-full rounded-md border border-studio-line bg-background"
                value={b.secondary}
                onChange={(e) => setB({ ...b, secondary: e.target.value })}
              />
            </label>
            <button className={btn} disabled={!!busy || !b.name.trim()} onClick={brand}>
              {busy === "brand" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Palette className="size-3.5" />
              )}
              Apply branding
            </button>
          </div>
          {ws.changes.length > 0 && (
            <ul className="font-mono text-[11px]">
              {ws.changes.map((c) => (
                <li key={c.path}>
                  <span className="text-studio-ok">changed</span> {c.path} · {c.replacements}×
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-[240px_1fr] gap-2">
            <ul className="max-h-72 overflow-auto rounded-md border border-studio-line font-mono text-[11px]">
              {ws.files.map((f) => (
                <li key={f.path}>
                  <button
                    onClick={() => setOpen(f.path)}
                    className={`w-full truncate px-2 py-1 text-left hover:bg-studio-raise ${open === f.path ? "text-accent" : ""}`}
                  >
                    {f.path}
                  </button>
                </li>
              ))}
            </ul>
            <pre className="max-h-72 overflow-auto rounded-md border border-studio-line bg-background p-2 font-mono text-[11px]">
              {file ? file.content : "Koi file chunein"}
            </pre>
          </div>
          <button className={btn2} disabled={!!busy} onClick={copyIn}>
            Re-copy from SSD
          </button>
        </>
      )}
      {err && <p className="text-sm text-studio-fail">{err}</p>}
    </section>
  );
}
